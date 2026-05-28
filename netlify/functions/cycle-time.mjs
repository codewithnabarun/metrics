import { buildTimepieceConfig, getTimepiecePage, resolveParamSetId } from '../../server/timepieceProxy.js';

const cfg = buildTimepieceConfig(process.env);

export default async (req) => {
  const requestUrl = new URL(req.url);
  const nextPageToken = requestUrl.searchParams.get('nextPageToken') || null;
  const paramSetId = resolveParamSetId({ requestUrl, config: cfg });

  console.log(`[cycle-time] Function invoked. Config: baseUrl=${cfg.baseUrl}, paramSetId=${paramSetId}, pageSize=${cfg.pageSize}, jwt=${cfg.jwt ? `[SET, length=${cfg.jwt.length}]` : '[NOT SET]'}, nextPageToken=${nextPageToken ?? 'null'}`);

  try {
    const page = await getTimepiecePage({
      nextPageToken,
      paramSetId,
      config: cfg,
      missingJwtMessage: 'TIS_JWT is not configured. Add it to Netlify environment variables.'
    });
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
