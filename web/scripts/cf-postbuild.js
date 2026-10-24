/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const webDir = path.resolve(__dirname, '..');
const nextDir = path.join(webDir, '.next');
const serverAppDir = path.join(nextDir, 'server', 'app');
const staticDir = path.join(nextDir, 'static');
const nextStaticTarget = path.join(nextDir, '_next', 'static');
const cacheDir = path.join(nextDir, 'cache');

console.log('[cf-postbuild] Running Cloudflare Pages preparation...');

// 1. Copy all generated HTML from server/app to .next root
if (fs.existsSync(serverAppDir)) {
  fs.cpSync(serverAppDir, nextDir, { recursive: true });
  console.log('✓ Copied server/app pages into .next root (index.html, approve.html, etc.)');
} else {
  console.warn('⚠ server/app dir not found at:', serverAppDir);
}

// 2. Ensure /_next/static matches what the HTML pages expect
if (fs.existsSync(staticDir)) {
  fs.mkdirSync(path.join(nextDir, '_next'), { recursive: true });
  fs.cpSync(staticDir, nextStaticTarget, { recursive: true });
  console.log('✓ Copied static assets into .next/_next/static');
}

// 3. Remove build cache & dev artifacts so Cloudflare 25 MB file size limit is never exceeded
if (fs.existsSync(cacheDir)) {
  fs.rmSync(cacheDir, { recursive: true, force: true });
  console.log('✓ Removed build cache to prevent 25MB file limit errors');
}
const devDir = path.join(nextDir, 'dev');
if (fs.existsSync(devDir)) {
  fs.rmSync(devDir, { recursive: true, force: true });
  console.log('✓ Removed dev cache');
}

// 4. Create _redirects file for clean SPA routing & API proxying on Cloudflare Pages
const redirects = [
  '/api/* http://13.126.39.176/api/:splat 200',
  '/approvals/* http://13.126.39.176/approvals/:splat 200',
  '/auth/* http://13.126.39.176/auth/:splat 200',
  '/batches/* http://13.126.39.176/batches/:splat 200',
  '/bills/* http://13.126.39.176/bills/:splat 200',
  '/payments/* http://13.126.39.176/payments/:splat 200',
  '/contacts/* http://13.126.39.176/contacts/:splat 200',
  '/workflows/* http://13.126.39.176/workflows/:splat 200',
  '/notifications/* http://13.126.39.176/notifications/:splat 200',
  '/health http://13.126.39.176/health 200',
  '/approve /approve.html 200',
  '/batches /batches.html 200',
  '/payments /payments.html 200',
  '/settings /settings.html 200',
  '/legacy /legacy.html 200',
  '/* /index.html 200',
].join('\n');

fs.writeFileSync(path.join(nextDir, '_redirects'), redirects, 'utf8');
console.log('✓ Generated Cloudflare Pages _redirects file');
console.log('[cf-postbuild] Done!');
