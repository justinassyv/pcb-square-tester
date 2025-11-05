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

  console.log('Starting flash process with real-time updates...');
  
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
    console.log('========================================');
    console.log('RAW Python output:', JSON.stringify(output));
    console.log('========================================');
    
    // Send all output to frontend for debugging
    res.write(`data: ${JSON.stringify({ type: 'debug', message: output })}\n\n`);
    res.flush?.();
    
    // Try to match any number in the output that might indicate PCB
    const anyNumberMatch = output.match(/(\d+)/);
    if (anyNumberMatch) {
      console.log(`Found number in output: ${anyNumberMatch[1]}`);
    }
    
    // Parse which channel is being selected (extract the channel number)
    const channelMatch = output.match(/=== Selecting channel (\d+) ===/);
    if (channelMatch) {
      currentPCB = parseInt(channelMatch[1]);
      console.log(`✓✓✓ MATCHED: Starting flash for PCB ${currentPCB}`);
      const message = JSON.stringify({ type: 'flashing', pcb: currentPCB });
      console.log(`>>> SENDING TO FRONTEND: ${message}`);
      res.write(`data: ${message}\n\n`);
      res.flush?.();
    }
    
    // Parse success - UART data was parsed and saved (with checkmark emoji)
    if (output.includes('✅ Parsed data saved to')) {
      console.log(`✓✓✓ MATCHED: Flash successful for PCB ${currentPCB}`);
      const message = JSON.stringify({ type: 'flash_complete', pcb: currentPCB });
      res.write(`data: ${message}\n\n`);
      res.flush?.();
    }
    
    // Parse failure - No UART data received
    if (output.includes('No UART data received')) {
      console.log(`✓✓✓ MATCHED: No UART data - Flash failed for PCB ${currentPCB}`);
      const message = JSON.stringify({ type: 'flash_failed', pcb: currentPCB });
      res.write(`data: ${message}\n\n`);
      res.flush?.();
    }
    
    // Parse failure - UART error
    if (output.includes('UART error')) {
      console.log(`✓✓✓ MATCHED: UART error - Flash failed for PCB ${currentPCB}`);
      const message = JSON.stringify({ type: 'flash_failed', pcb: currentPCB });
      res.write(`data: ${message}\n\n`);
      res.flush?.();
    }
    
    // Parse Done message
    if (output.includes('Done')) {
      console.log('✓✓✓ MATCHED: Done message received for PCB', currentPCB);
      const message = JSON.stringify({ type: 'all_done' });
      res.write(`data: ${message}\n\n`);
      res.flush?.();
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    const message = data.toString();
    console.error('Python error:', message);
    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    res.write(`data: ${JSON.stringify({ type: 'complete', code })}\n\n`);
    res.end();
  });

  pythonProcess.on('error', (error) => {
    console.error('Failed to start Python process:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    console.log('Client disconnected, killing Python process');
    pythonProcess.kill();
    activePythonProcess = null;
  });
});

// Kill process endpoint
app.post('/api/kill-process', (req, res) => {
  if (activePythonProcess) {
    console.log('Killing Python process via API request');
    activePythonProcess.kill('SIGKILL'); // Force kill immediately
    activePythonProcess = null;
    res.json({ status: 'ok', message: 'Process killed' });
  } else {
    res.json({ status: 'ok', message: 'No active process' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Script path: ~/Documents/sonora/jig.py`);
});
