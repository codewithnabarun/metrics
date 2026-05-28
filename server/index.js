import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { buildTimepieceConfig, getTimepiecePage, resolveParamSetId } from './timepieceProxy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

const app = express();
const port = Number(process.env.PORT || 8787);

const config = buildTimepieceConfig(process.env);
// console.log('Configuration:', { ...config, jwt: config.jwt ? `[SET, length=${config.jwt.length}]` : '[NOT SET]' });
app.use(cors());
app.use(express.json());

// Serve built frontend in production
if (existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.get('/api/timepiece/cycle-time', async (req, res) => {
  try {
    const requestUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
    const paramSetId = resolveParamSetId({ requestUrl, config });
    const page = await getTimepiecePage({
      nextPageToken: req.query.nextPageToken || null,
      paramSetId,
      config,
      missingJwtMessage: 'TIS_JWT is not configured. Add it to .env and restart the server.'
    });

    res.json({
      records: Array.isArray(page.results) ? page.results : [],
      nextPageToken: page.nextPageToken || null,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SPA fallback — must come after API routes
if (existsSync(distDir)) {
  app.get('/{*path}', (_req, res) => res.sendFile(join(distDir, 'index.html')));
}

app.listen(port, () => {
  console.log(`Cycle Time API proxy is running on http://localhost:${port}`);
});
