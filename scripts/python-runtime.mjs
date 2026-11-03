import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Explicit overrides are never silently replaced by a working interpreter.
export function pythonExecutable() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const relative = process.platform === 'win32' ? '../.venv/Scripts/python.exe' : '../.venv/bin/python';
  const candidate = fileURLToPath(new URL(relative, import.meta.url));
  return (existsSync(candidate) || existsSync(fileURLToPath(new URL('../.venv', import.meta.url)))) ? candidate : (process.platform === 'win32' ? 'python' : 'python3');
}
