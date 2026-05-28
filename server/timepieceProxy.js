export function buildTimepieceConfig(env) {
  return {
    baseUrl: env.TIS_BASE_URL || '',
    relativePath: env.TIS_RELATIVE_PATH || '/rest/list2',
    jwt: (env.TIS_JWT || '').trim(),
    paramSetId: env.TIS_PARAM_SET_ID || '',
    memberParamSetId: env.TIS_MEMBER_PARAM_SET_ID || '',
    pageSize: Number(env.TIS_PAGE_SIZE || 1000),
    statuses: env.TIS_STATUSES || ''
  };
}

export function resolveParamSetId({ requestUrl, config }) {
  return (
    requestUrl.searchParams.get('paramSetId') ||
    (requestUrl.searchParams.get('dataset') === 'members'
      ? config.memberParamSetId || config.paramSetId
      : config.paramSetId)
  );
}

export async function getTimepiecePage({
  nextPageToken,
  paramSetId,
  config,
  missingJwtMessage,
  logPrefix = 'cycle-time'
}) {
  if (!config.jwt || config.jwt === 'your token') {
    throw new Error(missingJwtMessage);
  }

  const url = new URL(config.relativePath, config.baseUrl);
  url.searchParams.set('paramSetId', paramSetId || config.paramSetId);
  url.searchParams.set('outputType', 'jsonSimplified');
  url.searchParams.set('viewFormat', 'days');
  url.searchParams.set('pageSize', String(config.pageSize));
  if (nextPageToken) url.searchParams.set('nextPageToken', nextPageToken);

  console.log(`[${logPrefix}] Fetching page, nextPageToken=${nextPageToken ?? 'null'}, paramSetId=${paramSetId || config.paramSetId}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `TISJWT ${config.jwt}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ statuses: config.statuses })
  });

  console.log(`[${logPrefix}] Response status: ${response.status}`);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Timepiece request failed: ${response.status}. ${body.slice(0, 500)}`);
  }

  return response.json();
}
