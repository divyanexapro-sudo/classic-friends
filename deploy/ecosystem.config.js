// pm2 process file — keeps the server running and restarts it after crashes or reboots.
// Usage: pm2 start deploy/ecosystem.config.js && pm2 save
const fs = require('fs'); const path = require('path');
const envFile = path.join(__dirname, '..', '.env');
const env = { NODE_ENV: 'production' };
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*(#.*)?$/); if (m) env[m[1]] = m[2]; }
module.exports = { apps: [{ name: 'classic-friends', script: 'server/index.js', cwd: path.join(__dirname, '..'), env, max_memory_restart: '400M', time: true }] };
