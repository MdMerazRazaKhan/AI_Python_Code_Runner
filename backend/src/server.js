const path = require('path');
// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const http = require('http');
const { WebSocketServer } = require('ws');
const { spawn, execSync } = require('child_process');
const app = require('./app');
const dockerService = require('./services/docker.service');
const fileHandler = require('./utils/fileHandler');

function getProcessMemoryUsage(pid) {
  if (process.platform === 'win32') {
    try {
      const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const parts = output.trim().split(',');
      if (parts.length >= 5) {
        const memStr = parts[parts.length - 1].replace(/"/g, '').replace(/[^0-9]/g, '');
        const kb = parseInt(memStr, 10);
        return isNaN(kb) ? 0 : kb * 1024;
      }
    } catch (e) {}
  } else {
    try {
      const fs = require('fs');
      if (fs.existsSync(`/proc/${pid}/status`)) {
        const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
        const match = status.match(/VmHWM:\s*(\d+)\s*kB/);
        if (match) {
          return parseInt(match[1], 10) * 1024;
        }
      }
    } catch (e) {}
    try {
      const output = execSync(`ps -p ${pid} -o rss=`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const kb = parseInt(output.trim(), 10);
      return isNaN(kb) ? 0 : kb * 1024;
    } catch (e) {}
  }
  return 0;
}

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
  let telemetryInterval = null;
  let timeoutTimer = null;

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message);

      if (payload.type === 'run') {
        const { code, fileName, language = 'python' } = payload;
        const normLang = language.toLowerCase();
        codeContent = code;
        activeFileName = fileName || `untitled.${normLang === 'python' ? 'py' : normLang === 'java' ? 'java' : normLang === 'cpp' ? 'cpp' : 'c'}`;
        activeLinesCount = code ? code.split('\n').length : 0;
        stdout = '';
        stderr = '';
        activeRunId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 11);
        startTime = process.hrtime();

        const fs = require('fs').promises;
        const fsExtra = require('fs');
        const os = require('os');
        const isDockerAvailable = dockerService.checkDockerAvailability();

        let maxMemoryBytes = 0;
        let limitExceeded = false;
        let limitReason = '';

        // Execution helper
        function setupChildStreams(cleanupCallback) {
          if (!child) return;

          maxMemoryBytes = 0;
          limitExceeded = false;
          limitReason = '';

          // 1. Time Limit: 10 seconds timeout limit
          timeoutTimer = setTimeout(() => {
            if (child) {
              limitExceeded = true;
              limitReason = 'Time Limit Exceeded (Limit: 10s)';
              ws.send(JSON.stringify({ type: 'stderr', data: `\nFATAL: Time Limit Exceeded (Limit: 10 seconds)\n` }));
              try {
                child.kill('SIGKILL');
              } catch (e) {}
            }
          }, 10000);

          // 2. Memory Limit: 256MB RAM usage limit
          telemetryInterval = setInterval(() => {
            if (!child || !child.pid) return;
            const mem = getProcessMemoryUsage(child.pid);
            if (mem > maxMemoryBytes) {
              maxMemoryBytes = mem;
            }
            if (mem > 256 * 1024 * 1024) {
              limitExceeded = true;
              limitReason = 'Memory Limit Exceeded (Limit: 256MB)';
              ws.send(JSON.stringify({ type: 'stderr', data: `\nFATAL: Memory Limit Exceeded (Allocated limit: 256 MB)\n` }));
              try {
                child.kill('SIGKILL');
              } catch (e) {}
            }
          }, 100);

          child.stdout.on('data', (data) => {
            stdout += data.toString();
            ws.send(JSON.stringify({ type: 'stdout', data: data.toString() }));
          });

          child.stderr.on('data', (data) => {
            stderr += data.toString();
            ws.send(JSON.stringify({ type: 'stderr', data: data.toString() }));
          });

          child.on('error', (err) => {
            ws.send(JSON.stringify({ type: 'stderr', data: `System Process Error: ${err.message}\n` }));
          });

          child.on('exit', async (exitCode) => {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            if (telemetryInterval) clearInterval(telemetryInterval);

            const diff = process.hrtime(startTime);
            const executionTime = Math.round((diff[0] * 1000) + (diff[1] / 1000000));

            // Clean up files
            if (tempFilePath) {
              try { await fs.unlink(tempFilePath); } catch (e) {}
              tempFilePath = '';
            }
            if (cleanupCallback) {
              try { await cleanupCallback(); } catch (e) {}
            }

            let status = 'Success';
            if (limitExceeded) {
              status = limitReason;
            } else if (exitCode !== 0) {
              status = 'Runtime Error';
            }

            const historyEntry = {
              id: activeRunId,
              prompt: activeFileName,
              code: codeContent,
              timestamp: new Date().toISOString(),
              status: status,
              executionTime: executionTime,
              memoryUsage: maxMemoryBytes,
              exitCode: exitCode !== null ? exitCode : -1,
              output: stdout,
              error: stderr,
              engine: isDockerAvailable && normLang === 'python' ? 'docker' : 'local',
              fileName: activeFileName,
              linesCount: activeLinesCount,
              language: normLang
            };

            await fileHandler.addHistoryEntry(historyEntry);

            ws.send(JSON.stringify({
              type: 'exit',
              code: exitCode !== null ? exitCode : -1,
              status: status,
              executionTime: executionTime,
              memoryUsage: maxMemoryBytes,
              engine: isDockerAvailable && normLang === 'python' ? 'docker' : 'local',
              historyEntry: historyEntry
            }));
          });
        }

        if (normLang === 'python') {
          if (isDockerAvailable) {
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
          setupChildStreams();
        } else if (normLang === 'c' || normLang === 'cpp') {
          const compilerCmd = normLang === 'c' ? 'gcc' : 'g++';
          try {
            execSync(`${compilerCmd} --version`, { stdio: 'ignore' });
          } catch (e) {
            ws.send(JSON.stringify({ type: 'stderr', data: `Compiler '${compilerCmd}' is not installed on this host system. Please install MinGW or GCC to run ${language.toUpperCase()} code.\n` }));
            ws.send(JSON.stringify({ type: 'exit', code: 1, status: 'Error', executionTime: 0 }));
            return;
          }

          const fileExt = normLang === 'c' ? 'c' : 'cpp';
          const srcPath = path.join(os.tmpdir(), `run_${activeRunId}.${fileExt}`);
          const exePath = path.join(os.tmpdir(), `run_${activeRunId}.exe`);
          await fs.writeFile(srcPath, code, 'utf8');

          const compileArgs = [srcPath, '-o', exePath];
          if (payload.version && (payload.version.startsWith('c++') || payload.version.startsWith('c'))) {
            compileArgs.push(`-std=${payload.version}`);
          }
          const compiler = spawn(compilerCmd, compileArgs);

          compiler.stderr.on('data', (data) => {
            ws.send(JSON.stringify({ type: 'stderr', data: data.toString() }));
          });

          compiler.on('close', async (exitCode) => {
            try { await fs.unlink(srcPath); } catch (e) {}

            if (exitCode !== 0) {
              ws.send(JSON.stringify({ type: 'exit', code: exitCode, status: 'Compile Error', executionTime: 0 }));
              return;
            }

            tempFilePath = exePath;
            child = spawn(exePath);
            setupChildStreams();
          });
        } else if (normLang === 'java') {
          try {
            execSync('javac -version', { stdio: 'ignore' });
          } catch (e) {
            ws.send(JSON.stringify({ type: 'stderr', data: "Java compiler (javac) is not installed on this host system. Please install JDK to run Java code.\n" }));
            ws.send(JSON.stringify({ type: 'exit', code: 1, status: 'Error', executionTime: 0 }));
            return;
          }

          const tempDir = path.join(os.tmpdir(), `run_${activeRunId}`);
          if (!fsExtra.existsSync(tempDir)) {
            fsExtra.mkdirSync(tempDir);
          }
          const javaFilePath = path.join(tempDir, 'Main.java');
          await fs.writeFile(javaFilePath, code, 'utf8');

          const compileArgs = [javaFilePath];
          if (payload.version && (payload.version === '17' || payload.version === '8')) {
            compileArgs.push('--release', payload.version);
          }
          const compiler = spawn('javac', compileArgs);

          compiler.stderr.on('data', (data) => {
            ws.send(JSON.stringify({ type: 'stderr', data: data.toString() }));
          });

          compiler.on('close', async (exitCode) => {
            if (exitCode !== 0) {
              try {
                const rimraf = fsExtra.rmSync || fsExtra.rmdirSync;
                rimraf(tempDir, { recursive: true, force: true });
              } catch (e) {}
              ws.send(JSON.stringify({ type: 'exit', code: exitCode, status: 'Compile Error', executionTime: 0 }));
              return;
            }

            child = spawn('java', ['-cp', tempDir, 'Main']);
            setupChildStreams(async () => {
              try {
                const rimraf = fsExtra.rmSync || fsExtra.rmdirSync;
                rimraf(tempDir, { recursive: true, force: true });
              } catch (e) {}
            });
          });
        } else {
          ws.send(JSON.stringify({ type: 'stderr', data: `Unsupported language requested: ${language}\n` }));
          ws.send(JSON.stringify({ type: 'exit', code: 1, status: 'Error', executionTime: 0 }));
        }
      }


      // Handle running multiple test cases
      if (payload.type === 'run_tests') {
        const { code, fileName, language = 'python', testCases = [] } = payload;
        const normLang = language.toLowerCase();
        
        let compileError = '';
        let runCmd = '';
        let runArgs = [];
        let cleanup = null;
        let tempFilePath = '';
        const isDockerAvailable = dockerService.checkDockerAvailability();

        const fs = require('fs').promises;
        const fsExtra = require('fs');
        const os = require('os');

        if (normLang === 'python') {
          tempFilePath = path.join(os.tmpdir(), `test_${Date.now()}_run.py`);
          await fs.writeFile(tempFilePath, code, 'utf8');

          let pythonCmd = 'python';
          try {
            execSync('python --version', { stdio: 'ignore' });
          } catch (e) {
            pythonCmd = 'python3';
          }
          runCmd = pythonCmd;
          runArgs = [tempFilePath];
          cleanup = async () => {
            try { await fs.unlink(tempFilePath); } catch (e) {}
          };
        } else if (normLang === 'c' || normLang === 'cpp') {
          const compilerCmd = normLang === 'c' ? 'gcc' : 'g++';
          const fileExt = normLang === 'c' ? 'c' : 'cpp';

          const srcPath = path.join(os.tmpdir(), `test_${Date.now()}.${fileExt}`);
          const exePath = path.join(os.tmpdir(), `test_${Date.now()}.exe`);
          await fs.writeFile(srcPath, code, 'utf8');

          const compileArgs = [srcPath, '-o', exePath];
          if (payload.version && (payload.version.startsWith('c++') || payload.version.startsWith('c'))) {
            compileArgs.push(`-std=${payload.version}`);
          }

          try {
            execSync(`${compilerCmd} ${compileArgs.join(' ')}`, { stdio: 'ignore' });
            runCmd = exePath;
            runArgs = [];
            cleanup = async () => {
              try { await fs.unlink(srcPath); } catch (e) {}
              try { await fs.unlink(exePath); } catch (e) {}
            };
          } catch (e) {
            compileError = `Compilation failed: check syntax errors.`;
            try { await fs.unlink(srcPath); } catch (e) {}
          }
        } else if (normLang === 'java') {
          const tempDir = path.join(os.tmpdir(), `test_${Date.now()}`);
          if (!fsExtra.existsSync(tempDir)) {
            fsExtra.mkdirSync(tempDir);
          }
          const javaFilePath = path.join(tempDir, 'Main.java');
          await fs.writeFile(javaFilePath, code, 'utf8');

          const compileArgs = [javaFilePath];
          if (payload.version && (payload.version === '17' || payload.version === '8')) {
            compileArgs.push('--release', payload.version);
          }

          try {
            execSync(`javac ${compileArgs.join(' ')}`, { stdio: 'ignore' });
            runCmd = 'java';
            runArgs = ['-cp', tempDir, 'Main'];
            cleanup = async () => {
              try {
                const rimraf = fsExtra.rmSync || fsExtra.rmdirSync;
                rimraf(tempDir, { recursive: true, force: true });
              } catch (e) {}
            };
          } catch (e) {
            compileError = `Compilation failed: check syntax errors.`;
            try {
              const rimraf = fsExtra.rmSync || fsExtra.rmdirSync;
              rimraf(tempDir, { recursive: true, force: true });
            } catch (e) {}
          }
        } else {
          compileError = `Unsupported language: ${language}`;
        }

        if (compileError) {
          ws.send(JSON.stringify({
            type: 'test_cases_exit',
            error: compileError,
            results: []
          }));
          return;
        }

        const results = [];
        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i];
          const result = await runSingleTestCase(runCmd, runArgs, tc.input);
          
          const cleanActual = result.output.trim().replace(/\r\n/g, '\n');
          const cleanExpected = (tc.expected || '').trim().replace(/\r\n/g, '\n');
          const passed = result.status === 'Success' && cleanActual === cleanExpected;

          results.push({
            id: tc.id || i,
            input: tc.input,
            expected: tc.expected,
            actual: result.output,
            error: result.error,
            status: result.status,
            passed,
            executionTime: result.executionTime,
            memoryUsage: result.memoryUsage,
            exitCode: result.exitCode
          });
        }

        if (cleanup) {
          await cleanup();
        }

        ws.send(JSON.stringify({
          type: 'test_cases_exit',
          results
        }));
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
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (telemetryInterval) clearInterval(telemetryInterval);
    if (tempFilePath) {
      const fs = require('fs');
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {}
    }
  });
});

function runSingleTestCase(cmd, args, stdinInput) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child = null;
    let startTime = process.hrtime();
    let maxMemoryBytes = 0;
    let limitExceeded = false;
    let limitReason = '';

    try {
      child = spawn(cmd, args);
    } catch (e) {
      return resolve({
        status: 'Error',
        output: '',
        error: `Failed to spawn process: ${e.message}`,
        executionTime: 0,
        memoryUsage: 0,
        exitCode: -1
      });
    }

    if (stdinInput) {
      child.stdin.write(stdinInput);
      child.stdin.end();
    } else {
      child.stdin.end();
    }

    const timeoutTimer = setTimeout(() => {
      if (child) {
        limitExceeded = true;
        limitReason = 'Time Limit Exceeded';
        try { child.kill('SIGKILL'); } catch (e) {}
      }
    }, 5000);

    const telemetryInterval = setInterval(() => {
      if (!child || !child.pid) return;
      const mem = getProcessMemoryUsage(child.pid);
      if (mem > maxMemoryBytes) {
        maxMemoryBytes = mem;
      }
      if (mem > 256 * 1024 * 1024) {
        limitExceeded = true;
        limitReason = 'Memory Limit Exceeded';
        try { child.kill('SIGKILL'); } catch (e) {}
      }
    }, 50);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('exit', (exitCode) => {
      clearTimeout(timeoutTimer);
      clearInterval(telemetryInterval);

      const diff = process.hrtime(startTime);
      const executionTime = Math.round((diff[0] * 1000) + (diff[1] / 1000000));

      let status = 'Success';
      if (limitExceeded) {
        status = limitReason;
      } else if (exitCode !== 0) {
        status = 'Runtime Error';
      }

      resolve({
        status,
        output: stdout,
        error: stderr,
        executionTime,
        memoryUsage: maxMemoryBytes,
        exitCode: exitCode !== null ? exitCode : -1
      });
    });
  });
}

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
