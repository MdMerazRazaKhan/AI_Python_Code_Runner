const path = require('path');
// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const http = require('http');
const { WebSocketServer } = require('ws');
const { spawn, execSync } = require('child_process');
const app = require('./app');
const dockerService = require('./services/docker.service');
const fileHandler = require('./utils/fileHandler');

const PORT = process.env.PORT || 5000;

// Create HTTP server wrapping Express
const server = http.createServer(app);

// Bind WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let child = null;
  let codeContent = '';
  let activeRunId = '';
  let stdout = '';
  let stderr = '';
  let startTime = null;
  let tempFilePath = '';
  let activeFileName = '';
  let activeLinesCount = 0;

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message);

      if (payload.type === 'run') {
        const { code, fileName } = payload;
        codeContent = code;
        activeFileName = fileName || 'untitled.py';
        activeLinesCount = code ? code.split('\n').length : 0;
        stdout = '';
        stderr = '';
        activeRunId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 11);
        startTime = process.hrtime();

        const isDockerAvailable = dockerService.checkDockerAvailability();

        if (isDockerAvailable) {
          // Spawn Python inside isolated Docker container, loading user code via an environment variable
          child = spawn('docker', [
            'run',
            '--rm',
            '-i',
            '--network', 'none',
            '--memory', '128m',
            '--cpus', '0.5',
            '-e', `CODE=${code}`,
            'python:3.13-slim',
            'python',
            '-c',
            "import os; exec(os.environ.get('CODE', ''))"
          ]);
        } else {
          // Spawn Python locally by writing user code to a temporary file
          const fs = require('fs').promises;
          const os = require('os');
          tempFilePath = path.join(os.tmpdir(), `run_${activeRunId}.py`);
          await fs.writeFile(tempFilePath, code, 'utf8');

          let pythonCmd = 'python';
          try {
            execSync('python --version', { stdio: 'ignore' });
          } catch (e) {
            pythonCmd = 'python3';
          }
          child = spawn(pythonCmd, [tempFilePath]);
        }

        // Stream stdout back to client in real-time
        child.stdout.on('data', (data) => {
          stdout += data.toString();
          ws.send(JSON.stringify({ type: 'stdout', data: data.toString() }));
        });

        // Stream stderr back to client in real-time
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          ws.send(JSON.stringify({ type: 'stderr', data: data.toString() }));
        });

        child.on('error', (err) => {
          ws.send(JSON.stringify({ type: 'stderr', data: `System Error: ${err.message}\n` }));
        });

        // Handle process termination
        child.on('exit', async (exitCode) => {
          const diff = process.hrtime(startTime);
          const executionTime = Math.round((diff[0] * 1000) + (diff[1] / 1000000));

          // Clean up local temp file
          if (tempFilePath) {
            const fs = require('fs').promises;
            try {
              await fs.unlink(tempFilePath);
            } catch (e) {}
            tempFilePath = '';
          }

          const status = exitCode === 0 ? 'Success' : 'Error';

          const historyEntry = {
            id: activeRunId,
            prompt: activeFileName,
            code: codeContent,
            timestamp: new Date().toISOString(),
            status: status,
            executionTime: executionTime,
            output: stdout,
            error: stderr,
            engine: isDockerAvailable ? 'docker' : 'local',
            fileName: activeFileName,
            linesCount: activeLinesCount
          };

          await fileHandler.addHistoryEntry(historyEntry);

          ws.send(JSON.stringify({
            type: 'exit',
            code: exitCode,
            status: status,
            executionTime: executionTime,
            engine: isDockerAvailable ? 'docker' : 'local',
            historyEntry: historyEntry
          }));
        });
      }

      // Handle terminal stdin writing
      if (payload.type === 'stdin') {
        const { data } = payload;
        if (child && child.stdin && child.stdin.writable) {
          child.stdin.write(data);
        }
      }
    } catch (e) {
      console.error('WS Error:', e);
      ws.send(JSON.stringify({ type: 'stderr', data: `WS System Error: ${e.message}\n` }));
    }
  });

  ws.on('close', () => {
    if (child) {
      child.kill('SIGKILL');
    }
    if (tempFilePath) {
      const fs = require('fs');
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {}
    }
  });
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  AI Python Code Runner Backend Service`);
  console.log(`  Running on port: http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=========================================`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down server gracefully...');
  server.close(() => {
    console.log('Server shut down successfully.');
  });
});
