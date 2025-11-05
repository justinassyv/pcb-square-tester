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
  const pythonProcess = spawn('python3', ['-u', scriptPath], {
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });
  
  // Store reference to active process
  activePythonProcess = pythonProcess;

  let currentPCB = 0; // Track current PCB being processed (will increment to 1 on first device)

  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Send all raw output to frontend
    res.write(`data: ${JSON.stringify({ type: 'raw_output', message: output })}\n\n`);
    res.flush?.();
    
    // Parse which channel is being selected (extract the channel number)
    const channelMatch = output.match(/=== Selecting channel (\d+) ===/);
    if (channelMatch) {
      currentPCB = parseInt(channelMatch[1]);
      console.log(`\n🔄 Processing PCB ${currentPCB}...`);
      res.write(`data: ${JSON.stringify({ type: 'flashing', pcb: currentPCB })}\n\n`);
      res.flush?.();
    }
    
    // Parse success - UART data was parsed and saved (with checkmark emoji)
    if (output.includes('✅ Parsed data saved to')) {
      console.log(`✅ PCB ${currentPCB} - Test PASSED`);
      res.write(`data: ${JSON.stringify({ type: 'flash_complete', pcb: currentPCB })}\n\n`);
      res.flush?.();
    }
    
    // Parse failure - No UART data received
    if (output.includes('No UART data received')) {
      console.log(`❌ PCB ${currentPCB} - FAILED (No UART data)`);
      res.write(`data: ${JSON.stringify({ type: 'flash_failed', pcb: currentPCB })}\n\n`);
      res.flush?.();
    }
    
    // Parse failure - UART error
    if (output.includes('UART error')) {
      console.log(`❌ PCB ${currentPCB} - FAILED (UART error)`);
      res.write(`data: ${JSON.stringify({ type: 'flash_failed', pcb: currentPCB })}\n\n`);
      res.flush?.();
    }
    
    // Parse Done message
    if (output.includes('Done')) {
      console.log(`\n✨ All PCBs processed\n`);
      res.write(`data: ${JSON.stringify({ type: 'all_done' })}\n\n`);
      res.flush?.();
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    const message = data.toString();
    console.error(`⚠️  Python error: ${message}`);
    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
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
