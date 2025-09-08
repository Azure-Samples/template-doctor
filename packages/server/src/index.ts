import { createApp } from './server.js';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 4000;
const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on port ${port}`);
});
