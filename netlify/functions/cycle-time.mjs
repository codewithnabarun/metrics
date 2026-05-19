const cfg = {
  baseUrl: process.env.TIS_BASE_URL || '',
  relativePath: process.env.TIS_RELATIVE_PATH || '/rest/list2',
  jwt: (process.env.TIS_JWT || '').trim(),
  paramSetId: process.env.TIS_PARAM_SET_ID || '',
  pageSize: Number(process.env.TIS_PAGE_SIZE || 1000),
  statuses:
    process.env.TIS_STATUSES ||
    '',
};

async function getTimepiecePage(nextPageToken) {
  if (!cfg.jwt) {
    throw new Error('TIS_JWT is not configured. Add it to Netlify environment variables.');
  }

  const url = new URL(cfg.relativePath, cfg.baseUrl);
  url.searchParams.set('paramSetId', cfg.paramSetId);
  url.searchParams.set('outputType', 'jsonSimplified');
  url.searchParams.set('viewFormat', 'days');
  url.searchParams.set('pageSize', String(cfg.pageSize));
  if (nextPageToken) url.searchParams.set('nextPageToken', nextPageToken);

  console.log(`[cycle-time] Fetching page, nextPageToken=${nextPageToken ?? 'null'}, url=${url.toString().replace(cfg.jwt, '[REDACTED]')}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `TISJWT ${cfg.jwt}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ statuses: cfg.statuses }),
  });

  console.log(`[cycle-time] Response status: ${response.status}`);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Timepiece request failed: ${response.status}. ${body.slice(0, 500)}`);
  }

  return response.json();
}

export default async (req) => {
  const requestUrl = new URL(req.url);
  const nextPageToken = requestUrl.searchParams.get('nextPageToken') || null;

  console.log(`[cycle-time] Function invoked. Config: baseUrl=${cfg.baseUrl}, paramSetId=${cfg.paramSetId}, pageSize=${cfg.pageSize}, jwt=${cfg.jwt ? `[SET, length=${cfg.jwt.length}]` : '[NOT SET]'}, nextPageToken=${nextPageToken ?? 'null'}`);

  try {
    const page = await getTimepiecePage(nextPageToken);
    const records = Array.isArray(page.results) ? page.results : [];
    const responseNextPageToken = page.nextPageToken || null;

    console.log(`[cycle-time] Page fetched: ${records.length} records, hasNextPage=${!!responseNextPageToken}`);

    return Response.json({
      records,
      nextPageToken: responseNextPageToken,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[cycle-time] Error:`, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

export const config = { path: '/api/timepiece/cycle-time', timeout: 26 };
