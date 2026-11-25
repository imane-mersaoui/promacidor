import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const app = createApp();
const server = app.listen(config.PORT, '127.0.0.1', () => {
  console.log(`Promasidor : serveur démarré sur 127.0.0.1:${config.PORT} (${config.NODE_ENV})`);
  console.log(`Espace admin : ${config.ADMIN_PATH}/`);
});
server.headersTimeout = 15_000;
server.requestTimeout = 20_000;

const stop = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
