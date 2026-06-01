import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { analyzeRouter } from './routes/analyze.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(express.static(publicDir));
app.use('/api/analyze', analyzeRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  const message = err.message || 'Internal server error';
  let status = 500;
  if (message.includes('GEMINI_API_KEY')) status = 503;
  if (message.includes('quota') || message.includes('Invalid GEMINI')) status = 503;
  res.status(status).json({ error: message });
});

const server = app.listen(config.port, () => {
  console.log(`Student Resume Intelligence Platform running at http://localhost:${config.port}`);
  console.log(`Open the browser to upload a resume and generate your report.`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Stop the other process or change PORT in .env.`);
    console.error(`Windows: netstat -ano | findstr :${config.port}  then  taskkill /PID <pid> /F`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
