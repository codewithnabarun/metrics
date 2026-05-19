const cfg = {
  baseUrl: process.env.TIS_BASE_URL || 'https://tis.obss.io',
  relativePath: process.env.TIS_RELATIVE_PATH || '/rest/list2',
  jwt: (process.env.TIS_JWT || '').trim(),
  paramSetId: process.env.TIS_PARAM_SET_ID || '90d83bca-42ed-4ebe-a96d-d0c49e1c28c4',
  pageSize: Number(process.env.TIS_PAGE_SIZE || 1000),
  statuses:
    process.env.TIS_STATUSES ||
    '1,4,10002,10006,10098,10092,10057,10031,10058,10003,10085,10070,10025,10094,10059',
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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `TISJWT ${cfg.jwt}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ statuses: cfg.statuses }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Timepiece request failed: ${response.status}. ${body.slice(0, 500)}`);
  }

  return response.json();
}

export default async () => {
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

    return Response.json({ records, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};

export const config = { path: '/api/timepiece/cycle-time' };
