import http from 'node:http';
import { config } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { initRealtime } from './realtime.js';

await connectDb();

const app = createApp();
const server = http.createServer(app);
initRealtime(server);

server.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}  (admin: /admin)`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
