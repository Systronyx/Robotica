import http from 'node:http';
import { Readable } from 'node:stream';

const upstream = new URL('https://edubot-v1-1-9deo25.v2.appdeploy.ai/');
const port = Number(process.env.PORT || 10000);

const skippedHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'content-security-policy',
  'keep-alive',
  'transfer-encoding',
  'x-frame-options',
]);

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    response.end('Método não permitido.');
    return;
  }

  try {
    const incoming = new URL(request.url || '/', 'http://localhost');
    const target = new URL(incoming.pathname + incoming.search, upstream);
    const headers = {};

    for (const name of ['accept', 'accept-language', 'range', 'user-agent']) {
      const value = request.headers[name];
      if (typeof value === 'string') headers[name] = value;
    }

    const upstreamResponse = await fetch(target, {
      method: request.method,
      headers,
      redirect: 'manual',
    });

    response.statusCode = upstreamResponse.status;

    upstreamResponse.headers.forEach((value, name) => {
      const normalized = name.toLowerCase();
      if (skippedHeaders.has(normalized)) return;
      if (normalized === 'location') {
        const location = new URL(value, upstream);
        response.setHeader(name, location.origin === upstream.origin
          ? location.pathname + location.search + location.hash
          : value);
        return;
      }
      response.setHeader(name, value);
    });

    response.setHeader('x-edubot-version', '1.1');

    if (request.method === 'HEAD' || !upstreamResponse.body) {
      response.end();
      return;
    }

    Readable.fromWeb(upstreamResponse.body).pipe(response);
  } catch (error) {
    console.error('Falha ao carregar o EduBot:', error);
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('EduBot temporariamente indisponível.');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`EduBot v1.1 disponível na porta ${port}`);
});
