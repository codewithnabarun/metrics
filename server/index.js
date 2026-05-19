import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

const app = express();
const port = Number(process.env.PORT || 8787);

const config = {
  baseUrl: process.env.TIS_BASE_URL || '',
  relativePath: process.env.TIS_RELATIVE_PATH || '/rest/list2',
  jwt: (process.env.TIS_JWT || '').trim(),
  paramSetId: process.env.TIS_PARAM_SET_ID || '',
  pageSize: Number(process.env.TIS_PAGE_SIZE || 1000),
  statuses: process.env.TIS_STATUSES || ''
};
// console.log('Configuration:', { ...config, jwt: config.jwt ? `[SET, length=${config.jwt.length}]` : '[NOT SET]' });
app.use(cors());
app.use(express.json());

// Serve built frontend in production
if (existsSync(distDir)) {
  app.use(express.static(distDir));
}

async function getTimepiecePage(nextPageToken) {
  if (!config.jwt || config.jwt === 'your token') {
    throw new Error('TIS_JWT is not configured. Add it to .env and restart the server.');
  }

  const url = new URL(config.relativePath, config.baseUrl);
  url.searchParams.set('paramSetId', config.paramSetId);
  url.searchParams.set('outputType', 'jsonSimplified');
  url.searchParams.set('viewFormat', 'days');
  url.searchParams.set('pageSize', String(config.pageSize));
  if (nextPageToken) url.searchParams.set('nextPageToken', nextPageToken);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `TISJWT ${config.jwt}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ statuses: config.statuses })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Timepiece request failed: ${response.status} ${response.statusText}. ${body.slice(0, 500)}`);
  }

  return response.json();
}

app.get('/api/timepiece/cycle-time', async (_req, res) => {
  try {
    const records = [];
    let nextPageToken = null;
    let safetyCounter = 0;

    do {
      const page = await getTimepiecePage(nextPageToken);
      if (Array.isArray(page.results)) records.push(...page.results);
      nextPageToken = page.nextPageToken || null;
      safetyCounter += 1;
    } while (nextPageToken && safetyCounter < 250);

    res.json({ records, fetchedAt: new Date().toISOString() });
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
