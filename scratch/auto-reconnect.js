const { execSync } = require('node:child_process');

console.log('[MONITOR] Waiting for Docker Desktop to be opened by user...');

function check() {
  try {
    const version = execSync('docker info --format "{{.ServerVersion}}"', { stdio: 'pipe' }).toString().trim();
    if (version) {
      console.log('[DOCKER_ONLINE] Version:', version);
      console.log('[DB_STARTING] Running docker compose up -d db...');
      execSync('docker compose up -d db', { stdio: 'inherit' });
      console.log('[API_STARTING] Starting NestJS API server on port 3001...');
      execSync('npm run start:dev --workspace=api', { stdio: 'inherit' });
      return;
    }
  } catch {
    // Docker engine not yet running
  }
  setTimeout(check, 3000);
}

check();

