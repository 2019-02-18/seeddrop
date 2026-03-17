// SECURITY MANIFEST:
//   Environment variables accessed: TEMP
//   External endpoints called: none
//   Local files read: project files for packaging
//   Local files written: seeddrop-v{version}.zip

import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptPath = join(__dirname, 'pack.ps1');

if (process.argv[2] === 'test') {
  console.log(JSON.stringify({ script: 'pack', status: 'ok', ps1: scriptPath }));
} else {
  execSync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
  });
}
