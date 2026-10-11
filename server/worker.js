import { assets } from '__game_assets__';
import { handleGameRequest } from './api.js';
import { testLoginEnabled } from './test-access.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/game/')) return handleGameRequest(request, env);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const file = assets[path === '/' ? '/index.html' : path];
    if (!file) return new Response('Not found', { status: 404 });
    if (file.binary) {
      const bytes = Uint8Array.from(atob(file.body), char => char.charCodeAt(0));
      const headers = { 'Content-Type': file.type, 'Cache-Control': 'public, max-age=86400', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
      const range = request.headers.get('Range');
      if (range && request.method === 'GET') {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        let start = match?.[1] ? Number(match[1]) : 0;
        let end = match?.[2] ? Number(match[2]) : bytes.length - 1;
        if (match && !match[1] && match[2]) { start = Math.max(0, bytes.length - Number(match[2])); end = bytes.length - 1; }
        end = Math.min(end, bytes.length - 1);
        if (!match || (!match[1] && !match[2]) || start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` } });
        return new Response(bytes.slice(start, end + 1), { status: 206, headers: { ...headers, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } });
      }
      return new Response(request.method === 'HEAD' ? null : bytes, { headers: { ...headers, 'Content-Length': String(bytes.length) } });
    }
    const isHtml = path === '/' || path === '/index.html';
    const body = isHtml ? file.body.replace('</head>', `<script>globalThis.TINY_LEGION_SIGNED_IN = ${Boolean(request.headers.get('oai-authenticated-user-id'))};globalThis.TINY_LEGION_TEST_LOGIN = ${testLoginEnabled(env)};</script></head>`) : file.body;
    return new Response(request.method === 'HEAD' ? null : body, { headers: {
      'Content-Type': file.type,
      'Cache-Control': isHtml ? 'no-store' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    } });
  },
};
