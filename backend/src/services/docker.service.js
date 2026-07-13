const { spawn, execSync } = require('child_process');

/**
 * Checks if Docker is installed and running on the host system.
 * Returns true if available, false otherwise.
 */
function checkDockerAvailability() {
  try {
    // Run 'docker ps' with a short timeout to see if the daemon is active
    execSync('docker ps', { stdio: 'ignore', timeout: 2000 });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Executes Python code inside a Docker container.
 */
function executeInDocker(code, timeoutMs = 5000) {
  return new Promise((resolve) => {
    // Spawn docker running a python slim container in interactive mode with restricted resources.
    // --network none prevents malicious network calls
    // --memory restricts RAM usage
    // --cpus restricts CPU usage
    const child = spawn('docker', [
      'run',
      '--rm',
      '-i',
      '--network', 'none',
      '--memory', '128m',
      '--cpus', '0.5',
      'python:3.13-slim',
      'python',
      '-'
    ]);

    let stdout = '';
    let stderr = '';
    let completed = false;

    // Timeout watchdog
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        child.kill('SIGKILL');
        resolve({
          output: stdout,
          error: `Execution Timed Out (Limit: ${timeoutMs / 1000}s)`,
          executionTime: timeoutMs,
          status: 'Timeout',
          engine: 'docker'
        });
      }
    }, timeoutMs);

    const startTime = process.hrtime();

    // Pipe the code to container's stdin
    child.stdin.write(code);
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
 * Executes Python code locally using the host Python binary.
 * This is used as a fallback when Docker is unavailable.
 */
function executeLocally(code, timeoutMs = 5000) {
  return new Promise((resolve) => {
    // Try both python and python3 command names
    let pythonCmd = 'python';
    try {
      execSync('python --version', { stdio: 'ignore' });
    } catch (e) {
      pythonCmd = 'python3';
    }

    const child = spawn(pythonCmd, ['-']);

    let stdout = '';
    let stderr = '';
    let completed = false;

    // Timeout watchdog
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        child.kill('SIGKILL');
        resolve({
          output: stdout,
          error: `Execution Timed Out (Limit: ${timeoutMs / 1000}s)`,
          executionTime: timeoutMs,
          status: 'Timeout',
          engine: 'local'
        });
      }
    }, timeoutMs);

    const startTime = process.hrtime();

    // Pipe the code to the local python process stdin
    child.stdin.write(code);
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
        error: `Failed to start Python process: ${err.message}. Make sure Python is in your PATH.`,
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

      // Append docker warning to inform user of current runtime context
      const dockerWarning = '[System Notice: Docker is not running or not installed. Running inside the host system environment with timeout controls.]\n';

      resolve({
        output: stdout,
        error: stderr,
        executionTime: executionTime,
        status: codeResult === 0 ? 'Success' : 'Error',
        engine: 'local',
        systemNotice: dockerWarning
      });
    });
  });
}

/**
 * Main execution routing method.
 */
async function executeCode(code, timeoutMs = 5000) {
  const isDockerAvailable = checkDockerAvailability();
  if (isDockerAvailable) {
    return await executeInDocker(code, timeoutMs);
  } else {
    return await executeLocally(code, timeoutMs);
  }
}

module.exports = {
  checkDockerAvailability,
  executeCode
};
