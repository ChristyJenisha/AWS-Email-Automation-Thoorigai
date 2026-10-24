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
  console.log('✓ Copied server/app pages into .next root');
}

// 2. Create directory-based index.html files so both /page and /page/ have direct index.html assets
const pages = ['batches', 'payments', 'settings', 'approve', 'legacy'];
pages.forEach((page) => {
  const htmlFile = path.join(serverAppDir, `${page}.html`);
  if (fs.existsSync(htmlFile)) {
    // Inside serverAppDir
    const pageDir = path.join(serverAppDir, page);
    fs.mkdirSync(pageDir, { recursive: true });
    fs.copyFileSync(htmlFile, path.join(pageDir, 'index.html'));

    // Inside nextDir
    const nextSubDir = path.join(nextDir, page);
    fs.mkdirSync(nextSubDir, { recursive: true });
    fs.copyFileSync(htmlFile, path.join(nextSubDir, 'index.html'));
  }
});
console.log('✓ Created directory index.html files for all static routes');

// 3. Ensure /_next/static matches what the HTML pages expect
if (fs.existsSync(staticDir)) {
  fs.mkdirSync(path.join(nextDir, '_next'), { recursive: true });
  fs.cpSync(staticDir, nextStaticTarget, { recursive: true });
  console.log('✓ Copied static assets into .next/_next/static');
}

// 4. Remove build cache & dev artifacts so Cloudflare 25 MB file size limit is never exceeded
if (fs.existsSync(cacheDir)) {
  fs.rmSync(cacheDir, { recursive: true, force: true });
  console.log('✓ Removed build cache to prevent 25MB file limit errors');
}
const devDir = path.join(nextDir, 'dev');
if (fs.existsSync(devDir)) {
  fs.rmSync(devDir, { recursive: true, force: true });
  console.log('✓ Removed dev cache');
}

// 5. Clean up any conflicting _redirects files
const redirectsPath = path.join(nextDir, '_redirects');
if (fs.existsSync(redirectsPath)) fs.unlinkSync(redirectsPath);
const appRedirectsPath = path.join(serverAppDir, '_redirects');
if (fs.existsSync(appRedirectsPath)) fs.unlinkSync(appRedirectsPath);

// 6. Populate web/dist with HTML and static directories
fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync(serverAppDir)) {
  fs.cpSync(serverAppDir, distDir, { recursive: true });
}
const distRedirectsPath = path.join(distDir, '_redirects');
if (fs.existsSync(distRedirectsPath)) fs.unlinkSync(distRedirectsPath);

console.log('✓ Populated web/dist cleanly without redirect conflict rules');
console.log('[cf-postbuild] Done!');
