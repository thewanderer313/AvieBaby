#!/usr/bin/env node
import { spawn } from 'node:child_process';
import open from 'open';

const server = spawn('npm', ['run', 'dev:server'], { stdio: 'inherit', shell: true });
const client = spawn('npm', ['run', 'dev:client'], { stdio: 'inherit', shell: true });

const CLIENT_URL = 'http://127.0.0.1:5175/';
setTimeout(() => {
  open(CLIENT_URL).catch(() => {
    console.log(`Open ${CLIENT_URL} in your browser.`);
  });
}, 1500);

const shutdown = () => {
  server.kill();
  client.kill();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
