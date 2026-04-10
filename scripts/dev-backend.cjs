/**
 * Cross-platform backend dev server: uses backend/venv Python on Windows vs macOS/Linux.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const backend = path.join(__dirname, '..', 'backend');
const py =
  process.platform === 'win32'
    ? path.join(backend, 'venv', 'Scripts', 'python.exe')
    : path.join(backend, 'venv', 'bin', 'python');

if (!fs.existsSync(py)) {
  console.error(
    '[dev-backend] Virtualenv not found at:',
    py,
    '\nCreate it: cd backend && python -m venv venv && pip install -r requirements.txt'
  );
  process.exit(1);
}

const child = spawn(
  py,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'],
  { cwd: backend, stdio: 'inherit', shell: false }
);
child.on('exit', (code) => process.exit(code ?? 0));
