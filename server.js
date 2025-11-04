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

// SSE endpoint for real-time progress updates
app.get('/api/flash-progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  console.log('Starting flash process with real-time updates...');
  
  const homeDir = os.homedir();
  const scriptPath = join(homeDir, 'Documents', 'sonora', 'jig.py');
  const pythonProcess = spawn('python3', [scriptPath]);

  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Python output:', output);
    
    // Parse which channel is being selected
    const channelMatch = output.match(/=== Selecting channel (\d+) ===/);
    if (channelMatch) {
      const channel = parseInt(channelMatch[1]);
      console.log(`Switching to PCB ${channel}`);
      res.write(`data: ${JSON.stringify({ type: 'channel_selected', pcb: channel })}\n\n`);
    }
    
    // Parse flashing status
    if (output.includes('Flashing board on channel')) {
      const flashMatch = output.match(/Flashing board on channel (\d+)/);
      if (flashMatch) {
        const channel = parseInt(flashMatch[1]);
        console.log(`Flashing PCB ${channel}`);
        res.write(`data: ${JSON.stringify({ type: 'flashing', pcb: channel })}\n\n`);
      }
    }
    
    // Parse completion
    if (output.includes('Programming completed successfully')) {
      console.log('Flash successful');
      res.write(`data: ${JSON.stringify({ type: 'flash_complete' })}\n\n`);
    }
    
    // Parse failure
    if (output.includes('Flashing failed')) {
      console.log('Flash failed');
      res.write(`data: ${JSON.stringify({ type: 'flash_failed' })}\n\n`);
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
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Script path: ~/Documents/sonora/jig.py`);
});
