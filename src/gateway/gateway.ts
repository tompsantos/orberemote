import http from 'node:http';
import { WebSocketServer } from 'ws';
import { DeviceRegistry } from './device-registry.js';
import { createMcpHttpHandler } from '../mcp/server.js';

export interface GatewayOptions {
  port: number;
  deviceToken: string;
  apiToken: string;
  auditPath: string;
}

function bearer(req: http.IncomingMessage): string | undefined {
  const value = req.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7) : undefined;
}

export async function startGateway(options: GatewayOptions) {
  const registry = new DeviceRegistry();
  const mcpHandler = createMcpHttpHandler(registry, options.auditPath);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, devices: registry.list().length }));
      return;
    }

    if (url.pathname === '/devices' && req.method === 'GET') {
      if (bearer(req) !== options.apiToken) { res.writeHead(401); res.end('unauthorized'); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(registry.list(), null, 2));
      return;
    }

    if (url.pathname === '/mcp') {
      if (bearer(req) !== options.apiToken) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
      await mcpHandler(req, res);
      return;
    }

    res.writeHead(404); res.end('not found');
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/agent' || bearer(req) !== options.deviceToken) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const deviceId = url.searchParams.get('deviceId');
    if (!deviceId || !/^[A-Za-z0-9._-]{1,80}$/.test(deviceId)) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => registry.register(deviceId, ws));
  });

  await new Promise<void>(resolve => server.listen(options.port, '0.0.0.0', resolve));
  console.error(`[orbe-gateway] listening on :${options.port}`);
  return { server, registry };
}
