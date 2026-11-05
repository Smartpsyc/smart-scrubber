// Serves the mock claude.ai page at /new and /chat/<uuid> on localhost.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./claude-mock.html', import.meta.url));

export function startMock() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/new' || path.startsWith('/chat/')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
      } else {
        res.writeHead(404).end();
      }
    });
    server.listen(0, () => resolve({ server, origin: `http://localhost:${server.address().port}` }));
  });
}
