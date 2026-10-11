import { assets } from '__game_assets__';
import { handleGameRequest } from './api.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/game/')) return handleGameRequest(request, env);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const file = assets[path === '/' ? '/index.html' : path];
    if (!file) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : file.body, { headers: {
      'Content-Type': file.type,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    } });
  },
};
