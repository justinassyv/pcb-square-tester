import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Store active python process
let activePythonProcess = null;

// SSE endpoint for real-time progress updates
app.get('/api/flash-progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  console.log('\n' + '='.repeat(50));
  console.log('🔬 Starting sensor test sequence...');
  console.log('='.repeat(50) + '\n');
  
  const homeDir = os.homedir();
  const scriptPath = join(homeDir, 'Documents', 'sonora', 'jig.py');
  
  // Use -u flag to force unbuffered output from Python
  // Set cwd to save test reports in the test_reports directory
  const reportsDir = '/home/rpi/Documents/ui/pcb-square-tester/test_reports';
  const pythonProcess = spawn('python3', ['-u', scriptPath], {
    cwd: reportsDir,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });
  
  // Store reference to active process
  activePythonProcess = pythonProcess;

  let currentPCB = 0; // Track current PCB being processed (will increment to 1 on first device)
  let stdoutCarry = '';
  let pendingExFlashDetections = 0;
  const exFlashDetectedPCBs = new Set();
  const flashCompletedPCBs = new Set();

  const exFlashPatterns = [
    /(?:^|\b)(?:ex|ext|external)\s*flash[^a-zA-Z0-9]{0,20}(?:initialized|init(?:ialized)?|ready|detected)\b/i,
    /(?:^|\b)(?:ex|ext|external)\s*flash[^\n\r]{0,160}(?:size|capacity)\s*[:=]?\s*\d+(?:\.\d+)?\s*(?:kb|mb)\b/i,
    /\bextflash\b[^\n\r]{0,80}(?:initialized|size|capacity)\b/i,
    /(?:^|\b)(?:ex|ext|external)\s*flash\s*[:=-][^\n\r]{0,80}\b\d+(?:\.\d+)?\s*(?:kb|mb)\b/i,
    /\b(?:ex|ext|external)flash[_\s-]*initialized\s*[:=]\s*(?:true|1|yes|ok|pass(?:ed)?)\b/i,
  ];

  const normalizeStreamText = (text) =>
    text
      .replace(/\x1B\[[0-9;]*[A-Za-z]/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const emitFlashComplete = (pcb) => {
    if (pcb <= 0 || flashCompletedPCBs.has(pcb)) return;
    flashCompletedPCBs.add(pcb);
    console.log(`✅ PCB ${pcb} - Test PASSED`);
    res.write(`data: ${JSON.stringify({ type: 'flash_complete', pcb })}\n\n`);
    res.flush?.();
  };

  const hasExFlashSignal = (text) => exFlashPatterns.some((pattern) => pattern.test(text));

  const emitPendingExFlashForCurrentPCB = () => {
    if (currentPCB <= 0 || pendingExFlashDetections <= 0 || exFlashDetectedPCBs.has(currentPCB)) return;
    pendingExFlashDetections -= 1;
    exFlashDetectedPCBs.add(currentPCB);
    res.write(`data: ${JSON.stringify({ type: 'exflash_detected', pcb: currentPCB })}\n\n`);
    res.flush?.();
  };

  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();

    // Send all raw output to frontend
    res.write(`data: ${JSON.stringify({ type: 'raw_output', message: output })}\n\n`);
    res.flush?.();

    const combined = `${stdoutCarry}${output}`;
    const normalizedCombined = normalizeStreamText(combined);

    // Parse channel robustly even when the marker line is split across stdout chunks
    const channelRegex = /(?:===\s*)?select(?:ing)?\s+channel\s+(\d+)(?:\s*===)?/gi;
    let match;
    let latestChannel = null;
    while ((match = channelRegex.exec(normalizedCombined)) !== null) {
      latestChannel = parseInt(match[1], 10);
    }

    const previousPCB = currentPCB;
    if (latestChannel && !Number.isNaN(latestChannel) && latestChannel !== currentPCB) {
      currentPCB = latestChannel;
      console.log(`\n🔄 Processing PCB ${currentPCB}...`);
      res.write(`data: ${JSON.stringify({ type: 'flashing', pcb: currentPCB })}\n\n`);
      res.flush?.();
      emitPendingExFlashForCurrentPCB();
    }

    // Fallback for first device: some rigs print exFlash line before any explicit channel banner.
    if (currentPCB <= 0 && pendingExFlashDetections > 0 && /\b(?:sonora\s+starting|mcu\s+reset\s+reasons|rtc\s+initialized)\b/i.test(normalizedCombined)) {
      currentPCB = 1;
      console.log(`\n🔄 Processing PCB ${currentPCB} (inferred before channel banner)...`);
      res.write(`data: ${JSON.stringify({ type: 'flashing', pcb: currentPCB })}\n\n`);
      res.flush?.();
      emitPendingExFlashForCurrentPCB();
    }

    // If channel just changed, don't let previous channel carry-over trigger exFlash on the new PCB
    const parseScope = currentPCB !== previousPCB ? output : combined;
    const normalizedScope = normalizeStreamText(parseScope);

    // Explicit exFlash detection from backend stream (often appears before reset/UART read)
    const exFlashDetected = hasExFlashSignal(normalizedScope);
    if (exFlashDetected) {
      if (currentPCB > 0 && !exFlashDetectedPCBs.has(currentPCB)) {
        exFlashDetectedPCBs.add(currentPCB);
        res.write(`data: ${JSON.stringify({ type: 'exflash_detected', pcb: currentPCB })}\n\n`);
        res.flush?.();
      } else if (currentPCB <= 0) {
        pendingExFlashDetections = Math.min(pendingExFlashDetections + 1, 6);
      }
    }

    // Parse success - UART data was parsed and saved
    const savedMatch = parseScope.match(/Parsed data saved to\s+([^\s]+\.txt)/i);
    if (savedMatch) {
      const channelSwitchedInThisChunk = currentPCB !== previousPCB;
      const pcbForParsed = channelSwitchedInThisChunk ? (previousPCB || currentPCB) : currentPCB;
      const reportFile = savedMatch[1];

      if (pcbForParsed > 0 && reportFile) {
        const reportPath = join(reportsDir, reportFile);
        fs.readFile(reportPath, 'utf8')
          .then((content) => {
            const exFlashInitialized = /^(?:ex|ext|external)flash[_\s-]*initialized\s*:\s*(?:true|1|yes|ok|pass(?:ed)?)\s*$/im.test(content)
              || /^(?:ex|ext|external)flash[_\s-]*(?:size|capacity)_(?:kb|mb)\s*:\s*\d+(?:\.\d+)?\s*$/im.test(content)
              || /^(?:ex|ext|external)flash[_\s-]*(?:size|capacity)\s*:\s*\d+(?:\.\d+)?\s*(?:kb|mb)\s*$/im.test(content);

            res.write(`data: ${JSON.stringify({
              type: 'parsed_report',
              pcb: pcbForParsed,
              exFlashInitialized,
            })}\n\n`);
            res.flush?.();
            emitFlashComplete(pcbForParsed);
          })
          .catch(() => {
            emitFlashComplete(pcbForParsed);
          });
      } else if (pcbForParsed > 0) {
        emitFlashComplete(pcbForParsed);
      }
    }

    // Parse failure - No UART data received
    if (/No UART data received/i.test(normalizedScope)) {
      console.log(`❌ PCB ${currentPCB} - FAILED (No UART data)`);
      res.write(`data: ${JSON.stringify({ type: 'flash_failed', pcb: currentPCB })}\n\n`);
      res.flush?.();
    }

    // Parse failure - UART error
    if (/UART error/i.test(normalizedScope)) {
      console.log(`❌ PCB ${currentPCB} - FAILED (UART error)`);
      res.write(`data: ${JSON.stringify({ type: 'flash_failed', pcb: currentPCB })}\n\n`);
      res.flush?.();
    }

    // Parse failure - J-Link connection error (error -102, etc.) - only if we're processing a specific PCB
    const jlinkErrorMatch = /error\s*(-?\d+):/i.test(normalizedScope);
    if (currentPCB > 0 && (jlinkErrorMatch || /command connect_to_emu|connect_to_emu_with_snr/i.test(normalizedScope))) {
      console.log(`❌ PCB ${currentPCB} - FAILED (J-Link connection error)`);
      res.write(`data: ${JSON.stringify({ type: 'flash_failed', pcb: currentPCB, error: 'jlink_connection' })}\n\n`);
      res.flush?.();
    }

    // Parse Done message
    if (/\bDone\b/i.test(normalizedScope)) {
      console.log(`\n✨ All PCBs processed\n`);
      res.write(`data: ${JSON.stringify({ type: 'all_done' })}\n\n`);
      res.flush?.();
    }

    // Keep a short tail to bridge split tokens only
    stdoutCarry = parseScope.slice(-240);
  });

  pythonProcess.stderr.on('data', (data) => {
    const message = data.toString();
    console.error(`⚠️  Python error: ${message}`);

    const normalizedError = normalizeStreamText(message);
    if (hasExFlashSignal(normalizedError)) {
      if (currentPCB > 0 && !exFlashDetectedPCBs.has(currentPCB)) {
        exFlashDetectedPCBs.add(currentPCB);
        res.write(`data: ${JSON.stringify({ type: 'exflash_detected', pcb: currentPCB })}\n\n`);
        res.flush?.();
      } else if (currentPCB <= 0) {
        pendingExFlashDetections = Math.min(pendingExFlashDetections + 1, 6);
      }
    }
    
    // Check for J-Link connection errors in stderr - mark PCB as failed but don't close connection
    if (currentPCB > 0 && (message.includes('error -102') || message.includes('connect_to_emu') || message.includes('Unable to connect to a debugger'))) {
      console.log(`❌ PCB ${currentPCB} - FAILED (J-Link connection error from stderr)`);
      res.write(`data: ${JSON.stringify({ type: 'flash_failed', pcb: currentPCB, error: 'jlink_connection' })}\n\n`);
      res.flush?.();
    }
    // Send as warning (non-fatal) instead of error to prevent frontend from closing connection
    res.write(`data: ${JSON.stringify({ type: 'warning', message })}\n\n`);
    res.flush?.();
  });

  pythonProcess.on('close', (code) => {
    console.log(`\n📋 Process completed (exit code: ${code})\n`);
    res.write(`data: ${JSON.stringify({ type: 'complete', code })}\n\n`);
    res.end();
  });

  pythonProcess.on('error', (error) => {
    console.error(`❌ Failed to start Python process: ${error.message}`);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    console.log('\n🔌 Client disconnected - terminating process\n');
    pythonProcess.kill();
    activePythonProcess = null;
  });
});

// Kill process endpoint
app.post('/api/kill-process', (req, res) => {
  if (activePythonProcess) {
    console.log('\n🛑 Terminating process via user request\n');
    activePythonProcess.kill('SIGKILL'); // Force kill immediately
    activePythonProcess = null;
    res.json({ status: 'ok', message: 'Process killed' });
  } else {
    console.log('\n⚠️  No active process to terminate\n');
    res.json({ status: 'ok', message: 'No active process' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 SONORA Sensor Tester - Backend Server');
  console.log('='.repeat(50));
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`📄 Script: ~/Documents/sonora/jig.py`);
  console.log('='.repeat(50) + '\n');
});
