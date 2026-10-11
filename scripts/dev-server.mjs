import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
mkdirSync(resolve(root, '.sites-local'), { recursive: true });
const sqlite = new DatabaseSync(resolve(root, '.sites-local/game.sqlite'));
sqlite.exec('PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS local_schema (name TEXT PRIMARY KEY)');
for (const file of readdirSync(resolve(root, 'drizzle')).filter(file => file.endsWith('.sql')).sort()) {
  if (sqlite.prepare('SELECT name FROM local_schema WHERE name = ?').get(file)) continue;
  sqlite.exec('BEGIN');
  try {
    sqlite.exec(readFileSync(resolve(root, 'drizzle', file), 'utf8').replaceAll('--> statement-breakpoint', ''));
    sqlite.prepare('INSERT INTO local_schema VALUES (?)').run(file);
    sqlite.exec('COMMIT');
  } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
}
let transactionTail = Promise.resolve();
const DB = { prepare(sql) { return { values: [], bind(...values) { this.values = values; return this; },
  async first() { return sqlite.prepare(sql).get(...this.values) ?? null; },
  async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...this.values).changes) } }; },
}; }, async batch(statements) {
  const previous = transactionTail;
  let release;
  transactionTail = new Promise(resolve => { release = resolve; });
  await previous;
  sqlite.exec('BEGIN');
  try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
  catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  finally { release(); }
} };
const worker = (await import(resolve(root, 'dist/server/index.js'))).default;
const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = []; let length = 0;
    for await (const chunk of incoming) {
      length += chunk.length;
      if (length > 524288) { outgoing.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const headers = new Headers(incoming.headers);
    // A local public listener must never treat caller-supplied Sites headers as identity.
    headers.delete('oai-authenticated-user-id'); headers.delete('oai-authenticated-user-email');
    const method = incoming.method;
    const request = new Request(`http://localhost:4174${incoming.url}`, {
      method, headers, ...(!['GET', 'HEAD'].includes(method) ? { body: Buffer.concat(chunks) } : {}),
    });
    const response = await worker.fetch(request, { DB });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error.message); outgoing.writeHead(500).end('Server error'); }
});
server.listen(4174, '127.0.0.1', () => console.log('Local server game: http://localhost:4174'));
process.on('SIGINT', () => server.close(() => { sqlite.close(); process.exit(0); }));
