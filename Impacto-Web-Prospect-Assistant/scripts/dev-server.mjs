import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const relative = normalize(pathname === '/' ? 'dashboard.html' : pathname.replace(/^\/+/, ''));
    const filePath = join(root, relative);
    if (!filePath.startsWith(root)) throw new Error('Caminho invalido');
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Arquivo nao encontrado');
    response.writeHead(200, {
      'Content-Type': mime[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(await readFile(filePath));
  } catch (_) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Nao encontrado');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Prospect Assistant em http://127.0.0.1:${port}/dashboard.html`);
});
