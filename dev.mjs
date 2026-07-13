import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

function parseEnvFile(content) {
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }
  return parsed;
}

function loadApiEnv(rootDir) {
  const envPath = path.join(rootDir, 'artifacts', 'api-server', '.env.local');
  if (!existsSync(envPath)) return {};
  const content = readFileSync(envPath, 'utf8');
  return parseEnvFile(content);
}

function runCommand(command, args, env, label, cwd = process.cwd(), shell = true) {
  const proc = spawn(command, args, {
    cwd,
    env,
    shell,
    stdio: 'inherit',
  });

  proc.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] finalizou com erro (code ${code}).`);
    }
  });

  return proc;
}

const rootDir = process.cwd();
const apiEnvFromFile = loadApiEnv(rootDir);

const apiPort = apiEnvFromFile.PORT || process.env.PORT || '3001';

const backendEnv = {
  ...process.env,
  ...apiEnvFromFile,
  NODE_ENV: 'development',
  PORT: apiPort,
};

const frontendEnv = {
  ...process.env,
  NODE_ENV: 'development',
  API_PORT: apiPort,
};

const backend = runCommand(
  'pnpm',
  ['--filter', '@workspace/api-server', 'run', 'dev'],
  backendEnv,
  'api',
  rootDir,
  true,
);

const frontend = runCommand(
  'pnpm',
  ['--filter', '@workspace/elton-garage', 'run', 'dev'],
  frontendEnv,
  'web',
  rootDir,
  true,
);

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!backend.killed) backend.kill();
  if (!frontend.killed) frontend.kill();
}

backend.on('exit', (code) => {
  if (code && code !== 0) shutdown();
});

frontend.on('exit', (code) => {
  if (code && code !== 0) shutdown();
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
