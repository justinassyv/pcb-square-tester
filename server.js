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

// Endpoint to execute the Python script
app.post('/api/flash-pcb', (req, res) => {
  console.log('Executing jig.py script...');
  
  // Get the home directory and construct the path
  const homeDir = os.homedir();
  const scriptPath = join(homeDir, 'Documents', 'sonora', 'jig.py');
  
  const pythonProcess = spawn('python3', [scriptPath]);
  
  let output = '';
  let errorOutput = '';
  
  pythonProcess.stdout.on('data', (data) => {
    const message = data.toString();
    console.log('Python stdout:', message);
    output += message;
  });
  
  pythonProcess.stderr.on('data', (data) => {
    const message = data.toString();
    console.error('Python stderr:', message);
    errorOutput += message;
  });
  
  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    
    if (code === 0) {
      res.json({ 
        success: true, 
        message: 'PCB flashed successfully',
        output: output
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to flash PCB',
        error: errorOutput || output,
        exitCode: code
      });
    }
  });
  
  pythonProcess.on('error', (error) => {
    console.error('Failed to start Python process:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to execute script',
      error: error.message
    });
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
