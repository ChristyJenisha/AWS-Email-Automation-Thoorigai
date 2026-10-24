/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const webDir = path.resolve(__dirname, '..');
const nextDir = path.join(webDir, '.next');
const serverAppDir = path.join(nextDir, 'server', 'app');
const staticDir = path.join(nextDir, 'static');
const nextStaticTarget = path.join(nextDir, '_next', 'static');
const cacheDir = path.join(nextDir, 'cache');
const distDir = path.join(webDir, 'dist');

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

// 4. Create _redirects file for clean SPA client-side routing on Cloudflare Pages
const redirects = [
  '/approve /approve.html 200',
  '/approve/* /approve.html 200',
  '/batches /batches.html 200',
  '/batches/* /batches.html 200',
  '/payments /payments.html 200',
  '/payments/* /payments.html 200',
  '/settings /settings.html 200',
  '/settings/* /settings.html 200',
  '/legacy /legacy.html 200',
  '/legacy/* /legacy.html 200',
  '/* /index.html 200',
].join('\n');

fs.writeFileSync(path.join(nextDir, '_redirects'), redirects, 'utf8');
if (fs.existsSync(serverAppDir)) {
  fs.writeFileSync(path.join(serverAppDir, '_redirects'), redirects, 'utf8');
}

// 5. Populate web/dist with HTML and _redirects
fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync(serverAppDir)) {
  fs.cpSync(serverAppDir, distDir, { recursive: true });
}
fs.writeFileSync(path.join(distDir, '_redirects'), redirects, 'utf8');

console.log('✓ Generated Cloudflare Pages _redirects and populated web/dist');
console.log('[cf-postbuild] Done!');
