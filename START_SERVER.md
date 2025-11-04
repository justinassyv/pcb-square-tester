# Running the PCB Tester with Backend

This application requires both a frontend (React) and backend (Node.js) server to run.

## Prerequisites

- Node.js v18 or higher
- Python 3 (for the jig.py script)
- The jig.py script should be located at: `~/Documents/sonora/jig.py`

## Starting the Application

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Backend Server (Terminal 1)

```bash
node server.js
```

The backend server will run on `http://localhost:3001`

### 3. Start the Frontend (Terminal 2)

```bash
npm run dev
```

The frontend will run on `http://localhost:8080`

## How It Works

- When you press the **FLASH PCB** button, the frontend connects to the backend's real-time progress endpoint
- The backend server executes the Python script at `~/Documents/sonora/jig.py` which processes all 6 PCBs in sequence
- As the script runs, real-time progress updates are sent to the UI via Server-Sent Events (SSE)
- The UI automatically switches to show which PCB is currently being flashed (PCB1 → PCB2 → ... → PCB6)
- Each PCB's status (pass/fail) is updated in real-time as the script processes it
- Toast notifications appear for each step of the process

## Accessing from Other Devices

To access from other devices on your network:

1. Backend: The server is already configured to accept connections from any IP
2. Frontend: Access using your RPi's IP address: `http://192.168.x.x:8080`

Make sure both servers are running for the FLASH PCB functionality to work!
