const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsExtra = require('fs');
const os = require('os');

/**
 * Checks if Docker is installed and running on the host system.
 */
function checkDockerAvailability() {
  try {
    execSync('docker ps', { stdio: 'ignore', timeout: 2000 });
    return true;
  } catch (err) {
    return false;
  }
}

// Minified python wrapper to parse code and pipe remaining standard inputs to user's program
const MINIFIED_WRAPPER = `import sys, os, subprocess, tempfile
try:
    l = sys.stdin.readline()
    if l:
        n = int(l.strip())
        c = sys.stdin.read(n)
        i = sys.stdin.read()
        fd, p = tempfile.mkstemp(suffix='.py')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                f.write(c)
            r = subprocess.run([sys.executable, p], input=i, text=True, capture_output=True)
            print(r.stdout, end='')
            print(r.stderr, file=sys.stderr, end='')
            sys.exit(r.returncode)
        finally:
            try:
                os.remove(p)
            except:
                pass
except Exception as e:
    print(f"Wrapper error: {e}", file=sys.stderr)
    sys.exit(1)
`;

/**
 * Executes Python code inside a Docker container with stdin support.
 */
function executeInDocker(code, timeoutMs = 5000, stdin = '') {
  return new Promise((resolve) => {
    // Run container with wrapper passed as command argument -c
    const child = spawn('docker', [
      'run',
      '--rm',
      '-i',
      '--network', 'none',
      '--memory', '128m',
      '--cpus', '0.5',
      'python:3.13-slim',
      'python',
      '-c',
      MINIFIED_WRAPPER
    ]);

    let stdout = '';
    let stderr = '';
    let completed = false;

    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        child.kill('SIGKILL');
        resolve({
          output: stdout,
          error: stderr || `Execution Timed Out (Limit: ${timeoutMs / 1000}s)`,
          executionTime: timeoutMs,
          status: 'Timeout',
          engine: 'docker'
        });
      }
    }, timeoutMs);

    const startTime = process.hrtime();

    // Stream inputs to child process stdin:
    // Format: [user_code_length]\n[user_code][user_stdin_inputs]
    child.stdin.write(`${code.length}\n`);
    child.stdin.write(code);
    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      resolve({
        output: stdout,
        error: `System Process Error: ${err.message}`,
        executionTime: 0,
        status: 'Error',
        engine: 'docker'
      });
    });

    child.on('exit', (codeResult) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);

      const diff = process.hrtime(startTime);
      const executionTime = Math.round((diff[0] * 1000) + (diff[1] / 1000000));

      resolve({
        output: stdout,
        error: stderr,
        executionTime: executionTime,
        status: codeResult === 0 ? 'Success' : 'Error',
        engine: 'docker'
      });
    });
  });
}

/**
 * Executes Python code locally using the host Python binary with stdin support.
 */
function executeLocally(code, timeoutMs = 5000, stdin = '') {
  return new Promise((resolve) => {
    let pythonCmd = 'python';
    try {
      execSync('python --version', { stdio: 'ignore' });
    } catch (e) {
      pythonCmd = 'python3';
    }

    // Run local python process with wrapper passed as command argument -c
    const child = spawn(pythonCmd, ['-c', MINIFIED_WRAPPER]);

    let stdout = '';
    let stderr = '';
    let completed = false;

    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        child.kill('SIGKILL');
        resolve({
          output: stdout,
          error: stderr || `Execution Timed Out (Limit: ${timeoutMs / 1000}s)`,
          executionTime: timeoutMs,
          status: 'Timeout',
          engine: 'local'
        });
      }
    }, timeoutMs);

    const startTime = process.hrtime();

    // Stream inputs to child process stdin:
    // Format: [user_code_length]\n[user_code][user_stdin_inputs]
    child.stdin.write(`${code.length}\n`);
    child.stdin.write(code);
    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      resolve({
        output: stdout,
        error: stderr || `Failed to start Python process: ${err.message}.`,
        executionTime: 0,
        status: 'Error',
        engine: 'local'
      });
    });

    child.on('exit', (codeResult) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);

      const diff = process.hrtime(startTime);
      const executionTime = Math.round((diff[0] * 1000) + (diff[1] / 1000000));

      resolve({
        output: stdout,
        error: stderr,
        executionTime: executionTime,
        status: codeResult === 0 ? 'Success' : 'Error',
        engine: 'local'
      });
    });
  });
}

/**
 * Main execution routing method supporting multiple languages.
 */
async function executeCode(code, timeoutMs = 5000, stdin = '', language = 'python') {
  const normLang = (language || 'python').toLowerCase();

  if (normLang === 'python') {
    const isDockerAvailable = checkDockerAvailability();
    if (isDockerAvailable) {
      return await executeInDocker(code, timeoutMs, stdin);
    } else {
      return await executeLocally(code, timeoutMs, stdin);
    }
  }

  // Handle local compilation and execution for C, C++, Java
  return new Promise(async (resolve) => {
    const activeRunId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 11);
    let tempFilePath = '';
    let exePath = '';
    let tempDir = '';
    let child = null;
    let completed = false;
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        if (child) child.kill('SIGKILL');
        cleanupTempFiles();
        resolve({
          output: stdout,
          error: stderr || `Execution Timed Out (Limit: ${timeoutMs / 1000}s)`,
          executionTime: timeoutMs,
          status: 'Timeout',
          engine: 'local'
        });
      }
    }, timeoutMs);

    const startTime = process.hrtime();

    async function cleanupTempFiles() {
      if (tempFilePath) {
        try { await fs.unlink(tempFilePath); } catch (e) {}
      }
      if (exePath) {
        try { await fs.unlink(exePath); } catch (e) {}
      }
      if (tempDir) {
        try {
          const rimraf = fsExtra.rmSync || fsExtra.rmdirSync;
          rimraf(tempDir, { recursive: true, force: true });
        } catch (e) {}
      }
    }

    function runChildProcess() {
      if (stdin) {
        child.stdin.write(stdin);
      }
      child.stdin.end();

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        cleanupTempFiles();
        resolve({
          output: stdout,
          error: `Process Execution Error: ${err.message}`,
          executionTime: 0,
          status: 'Error',
          engine: 'local'
        });
      });

      child.on('exit', (codeResult) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        cleanupTempFiles();

        const diff = process.hrtime(startTime);
        const executionTime = Math.round((diff[0] * 1000) + (diff[1] / 1000000));

        resolve({
          output: stdout,
          error: stderr,
          executionTime: executionTime,
          status: codeResult === 0 ? 'Success' : 'Error',
          engine: 'local'
        });
      });
    }

    try {
      if (normLang === 'c' || normLang === 'cpp') {
        const compilerCmd = normLang === 'c' ? 'gcc' : 'g++';
        try {
          execSync(`${compilerCmd} --version`, { stdio: 'ignore' });
        } catch (e) {
          clearTimeout(timer);
          return resolve({
            output: '',
            error: `Compiler '${compilerCmd}' is not installed on this host system. Please install MinGW or GCC to run ${language.toUpperCase()} code.`,
            executionTime: 0,
            status: 'Error',
            engine: 'local'
          });
        }

        const fileExt = normLang === 'c' ? 'c' : 'cpp';
        tempFilePath = path.join(os.tmpdir(), `run_${activeRunId}.${fileExt}`);
        exePath = path.join(os.tmpdir(), `run_${activeRunId}.exe`);
        await fs.writeFile(tempFilePath, code, 'utf8');

        // Compile
        const compiler = spawn(compilerCmd, [tempFilePath, '-o', exePath]);
        let compileStderr = '';

        compiler.stderr.on('data', (data) => {
          compileStderr += data.toString();
        });

        compiler.on('exit', (exitCode) => {
          if (exitCode !== 0) {
            clearTimeout(timer);
            cleanupTempFiles();
            return resolve({
              output: '',
              error: compileStderr || 'Compilation Failed.',
              executionTime: 0,
              status: 'Compile Error',
              engine: 'local'
            });
          }

          // Spawning compiled exe
          child = spawn(exePath);
          runChildProcess();
        });
      } else if (normLang === 'java') {
        try {
          execSync('javac -version', { stdio: 'ignore' });
        } catch (e) {
          clearTimeout(timer);
          return resolve({
            output: '',
            error: 'Java compiler (javac) is not installed on this host system. Please install JDK to run Java code.',
            executionTime: 0,
            status: 'Error',
            engine: 'local'
          });
        }

        tempDir = path.join(os.tmpdir(), `run_${activeRunId}`);
        if (!fsExtra.existsSync(tempDir)) {
          fsExtra.mkdirSync(tempDir);
        }
        const javaFilePath = path.join(tempDir, 'Main.java');
        await fs.writeFile(javaFilePath, code, 'utf8');

        // Compile
        const compiler = spawn('javac', [javaFilePath]);
        let compileStderr = '';

        compiler.stderr.on('data', (data) => {
          compileStderr += data.toString();
        });

        compiler.on('exit', (exitCode) => {
          if (exitCode !== 0) {
            clearTimeout(timer);
            cleanupTempFiles();
            return resolve({
              output: '',
              error: compileStderr || 'Java Compilation Failed.',
              executionTime: 0,
              status: 'Compile Error',
              engine: 'local'
            });
          }

          // Spawning compiled Java code
          child = spawn('java', ['-cp', tempDir, 'Main']);
          runChildProcess();
        });
      } else {
        clearTimeout(timer);
        resolve({
          output: '',
          error: `Unsupported language requested: ${language}`,
          executionTime: 0,
          status: 'Error',
          engine: 'local'
        });
      }
    } catch (e) {
      clearTimeout(timer);
      cleanupTempFiles();
      resolve({
        output: '',
        error: `Sandbox execution setup error: ${e.message}`,
        executionTime: 0,
        status: 'Error',
        engine: 'local'
      });
    }
  });
}

module.exports = {
  checkDockerAvailability,
  executeCode
};
