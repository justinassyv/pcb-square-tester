import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

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
  const exFlashDetectedPCBs = new Set();

  const normalizeStreamText = (text) =>
    text
      .replace(/\x1B\[[0-9;]*[A-Za-z]/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();

    // Send all raw output to frontend
    res.write(`data: ${JSON.stringify({ type: 'raw_output', message: output })}\n\n`);
    res.flush?.();

    const combined = `${stdoutCarry}${output}`;
    const normalizedCombined = normalizeStreamText(combined);

    // Parse channel robustly even when the marker line is split across stdout chunks
    const channelRegex = /===\s*Selecting\s+channel\s+(\d+)\s*===/gi;
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
    }

    // If channel just changed, don't let previous channel carry-over trigger exFlash on the new PCB
    const parseScope = currentPCB !== previousPCB ? output : combined;
    const normalizedScope = normalizeStreamText(parseScope);

    // Explicit exFlash detection from backend stream (often appears before reset/UART read)
    const exFlashDetected = /ex\s*flash[^a-zA-Z0-9]{0,12}initialized/i.test(normalizedScope)
      || /ex\s*flash[^\n\r]{0,160}size\s*\d+\s*kb/i.test(normalizedScope)
      || /exflash[^\n\r]{0,40}initialized/i.test(normalizedScope);
    if (currentPCB > 0 && exFlashDetected && !exFlashDetectedPCBs.has(currentPCB)) {
      exFlashDetectedPCBs.add(currentPCB);
      res.write(`data: ${JSON.stringify({ type: 'exflash_detected', pcb: currentPCB })}\n\n`);
      res.flush?.();
    }

    // Parse success - UART data was parsed and saved
    if (/Parsed data saved to/i.test(normalizedScope)) {
      console.log(`✅ PCB ${currentPCB} - Test PASSED`);
      res.write(`data: ${JSON.stringify({ type: 'flash_complete', pcb: currentPCB })}\n\n`);
      res.flush?.();
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
