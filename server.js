const { spawn } = require('child_process');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');

const ROOT = __dirname;
const API_DIR = path.join(ROOT, 'apps', 'api');
const WEB_DIR = path.join(ROOT, 'apps', 'web');
const API_DIST = path.join(API_DIR, 'dist', 'index.js');
const WEB_BUILD_ID = path.join(WEB_DIR, '.next', 'BUILD_ID');
const NODE = process.execPath;

const children = [];

function log(prefix, data) {
  process.stdout.write(`[${prefix}] ${data}`);
}

function patchRoutesManifest() {
  const manifestPath = path.join(WEB_DIR, '.next', 'routes-manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const data = JSON.parse(readFileSync(manifestPath, 'utf8'));
      let modified = false;
      if (!Array.isArray(data.dataRoutes)) {
        data.dataRoutes = [];
        modified = true;
      }
      if (!Array.isArray(data.staticRoutes)) {
        data.staticRoutes = [];
        modified = true;
      }
      if (!Array.isArray(data.dynamicRoutes)) {
        data.dynamicRoutes = [];
        modified = true;
      }
      if (modified) {
        writeFileSync(manifestPath, JSON.stringify(data, null, 2));
      }
    } catch {}
  }
}

function runCommand(cmd, args, cwd, label) {
  console.log(`\n▶ Building ${label}...`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} build failed with exit code ${code}`));
    });
  });
}

function startService(label, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  child.stdout.on('data', (d) => log(label, d));
  child.stderr.on('data', (d) => log(label, d));
  child.on('close', (code) => {
    console.error(`\n❌ ${label} exited with code ${code}. Shutting down all services...`);
    shutdown(1);
  });
  children.push(child);
  return child;
}

function shutdown(code) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500).unref();
}

async function main() {
  console.log('========================================');
  console.log('  WP Bot — Full Stack Launcher');
  console.log('========================================\n');

  if (!existsSync(path.join(ROOT, 'node_modules'))) {
    console.error('❌ Dependencies not installed. Run `pnpm install` first.');
    process.exit(1);
  }

  try {
    if (!existsSync(API_DIST)) {
      await runCommand('pnpm', ['--filter', '@private-md-bot/api', 'build'], ROOT, 'API server');
    } else {
      console.log('✓ API build found — skipping build');
    }

    if (process.env.API_ONLY !== 'true' && !existsSync(WEB_BUILD_ID)) {
      try {
        await runCommand('pnpm', ['--filter', '@private-md-bot/web', 'build'], ROOT, 'web dashboard');
      } catch (e) {
        console.log('ℹ Web build skipped or standalone deployment mode');
      }
    } else if (process.env.API_ONLY !== 'true') {
      console.log('✓ Web build found — skipping build');
    }
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }

  patchRoutesManifest();

  const api = startService('api', NODE, [API_DIST], API_DIR);
  api.once('spawn', () => console.log('✓ API server starting on http://localhost:4000'));

  // Find Next.js executable across monorepo hoisted node_modules
  const nextBinCandidates = [
    path.join(WEB_DIR, 'node_modules', 'next', 'dist', 'bin', 'next'),
    path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'),
    path.join(ROOT, 'node_modules', '.bin', 'next'),
  ];
  const nextBin = nextBinCandidates.find((p) => existsSync(p));

  const shouldStartWeb = process.env.API_ONLY !== 'true' && nextBin;

  if (shouldStartWeb && nextBin) {
    const web = startService('web', NODE, [nextBin, 'start', '-p', '3000'], WEB_DIR);
    web.once('spawn', () => console.log('✓ Web dashboard starting on http://localhost:3000\n'));
  } else {
    console.log('ℹ Running API Backend mode (Web dashboard hosted on Netlify)\n');
  }

  console.log('Services running. Press Ctrl+C to stop.\n');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
