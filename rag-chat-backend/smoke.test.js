const { spawn } = require('child_process');
const http = require('http');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 5000, path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

function httpPost(path, payload) {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 5000, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const server = spawn(process.execPath, ['server.js'], { stdio: ['ignore', 'pipe', 'pipe'] });

  let ready = false;
  server.stdout.on('data', (d) => {
    const s = d.toString();
    process.stdout.write(s);
    if (s.includes('Server running') || s.includes('Indexed')) ready = true;
  });
  server.stderr.on('data', (d) => process.stderr.write(d.toString()));

  // wait up to 30s for ready logs
  for (let i = 0; i < 60 && !ready; i++) await wait(500);
  if (!ready) {
    console.error('Server did not become ready in time');
    server.kill('SIGINT');
    process.exit(1);
  }

  // Health
  const health = await httpGet('/');
  if (health.status !== 200) throw new Error('Health failed');

  // Key check
  const keyCheck = await httpGet('/key-check');
  if (keyCheck.status !== 200) throw new Error('key-check failed');

  // Chat
  const chat = await httpPost('/chat', { sessionId: 'smoke', query: 'Say hello in one sentence.' });
  if (chat.status !== 200) throw new Error('chat failed');

  // History
  const hist = await httpGet('/history/smoke');
  if (hist.status !== 200) throw new Error('history failed');

  console.log('\n✅ Smoke test passed');
  server.kill('SIGINT');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Smoke test error:', err);
  process.exit(1);
}); 