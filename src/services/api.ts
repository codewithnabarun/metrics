import { IssueRecord, RawIssue } from '../types';
import { toDateOrNull, transformIssues } from '../utils/transform';
import { mockIssues } from './mockData';

export type FetchProgress = {
  fetched: number;
  page: number;
  hasMore: boolean;
  lastPageCount: number;
  avgMsPerPage: number;
};

export type TimepieceDataset = 'default' | 'members';
export type TimepieceDataSource = 'api' | 'cache' | 'mock';

type FetchTimepieceOptions = {
  dataset?: TimepieceDataset;
  paramSetId?: string;
  onProgress?: (p: FetchProgress) => void;
  initialNextPageToken?: string | null;
  pageProcessor?: (
    pageRecords: RawIssue[],
    context: {
      page: number;
      requestedPageToken: string | null;
      responseNextPageToken: string | null;
      accumulatedCount: number;
    }
  ) => {
    recordsToAppend?: RawIssue[];
    deferredRecords?: RawIssue[];
    stop?: boolean;
    resumeNextPageToken?: string | null;
  };
};

type TimepiecePageResponse = {
  error?: string;
  records?: RawIssue[];
  nextPageToken?: string | null;
};

const CACHE_PREFIX = 'cycle-time-cache';
const MAX_FETCH_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [0, 800, 1800];

type FetchTimepieceRecordsResult = {
  records: RawIssue[];
  deferredRecords: RawIssue[];
  nextPageToken: string | null;
  completed: boolean;
};

type ProcessedTimepieceResult = {
  data: IssueRecord[];
  deferredData: IssueRecord[];
  nextPageToken: string | null;
  completed: boolean;
};

function buildTimepieceUrl(
  nextPageToken: string | null,
  { dataset = 'default', paramSetId }: Pick<FetchTimepieceOptions, 'dataset' | 'paramSetId'>
): string {
  const searchParams = new URLSearchParams();
  if (nextPageToken) searchParams.set('nextPageToken', nextPageToken);
  if (dataset !== 'default') searchParams.set('dataset', dataset);
  if (paramSetId) searchParams.set('paramSetId', paramSetId);
  const query = searchParams.toString();
  return query ? `/api/timepiece/cycle-time?${query}` : '/api/timepiece/cycle-time';
}

function getCacheKey({ dataset = 'default', paramSetId }: Pick<FetchTimepieceOptions, 'dataset' | 'paramSetId'>): string {
  return `${CACHE_PREFIX}:${dataset}:${paramSetId ?? 'default'}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readCachedDataset(
  options: Pick<FetchTimepieceOptions, 'dataset' | 'paramSetId'> = {}
): IssueRecord[] | null {
  try {
    const cached = window.sessionStorage.getItem(getCacheKey(options));
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    return Array.isArray(parsed) ? (parsed as IssueRecord[]) : null;
  } catch {
    return null;
  }
}

function writeCachedDataset(
  data: IssueRecord[],
  options: Pick<FetchTimepieceOptions, 'dataset' | 'paramSetId'> = {}
): void {
  try {
    window.sessionStorage.setItem(getCacheKey(options), JSON.stringify(data));
  } catch {
    // Ignore storage quota and availability issues.
  }
}

async function fetchTimepiecePageWithRetry(
  nextPageToken: string | null,
  options: Pick<FetchTimepieceOptions, 'dataset' | 'paramSetId'>
): Promise<TimepiecePageResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(buildTimepieceUrl(nextPageToken, options));
      const rawText = await response.text();
      let json: TimepiecePageResponse = {};

      if (rawText) {
        try {
          json = JSON.parse(rawText) as TimepiecePageResponse;
        } catch {
          if (response.status && RETRYABLE_STATUSES.has(response.status) && attempt < MAX_FETCH_ATTEMPTS) {
            await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
            continue;
          }

          throw new Error(
            `Server returned an invalid response (HTTP ${response.status}). The function may have timed out - check server logs.`
          );
        }
      }

      if (!response.ok) {
        const message = json.error || `HTTP ${response.status}`;
        if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_FETCH_ATTEMPTS) {
          await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
          continue;
        }

        throw new Error(message);
      }

      return json;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown API error');
      const isRetryable =
        /Failed to fetch|NetworkError|timed out|invalid response/i.test(lastError.message);

      if (attempt < MAX_FETCH_ATTEMPTS && isRetryable) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
        continue;
      }
    }
  }

  throw lastError ?? new Error('Unknown API error');
}

export async function fetchTimepieceRecords({
  dataset = 'default',
  paramSetId,
  onProgress,
  initialNextPageToken = null,
  pageProcessor
}: FetchTimepieceOptions = {}): Promise<FetchTimepieceRecordsResult> {
  const allRecords: RawIssue[] = [];
  let deferredRecords: RawIssue[] = [];
  let nextPageToken: string | null = initialNextPageToken;
  let safetyCounter = 0;
  const pageTimes: number[] = [];
  let pageStart = Date.now();

  do {
    const requestedPageToken = nextPageToken;
    const json = await fetchTimepiecePageWithRetry(requestedPageToken, { dataset, paramSetId });

    const pageRecords = Array.isArray(json.records) ? json.records : [];
    const responseNextPageToken = json.nextPageToken || null;
    safetyCounter++;

    let recordsToAppend = pageRecords;
    let shouldStop = false;
    let resumeNextPageToken = responseNextPageToken;

    if (pageProcessor) {
      const decision = pageProcessor(pageRecords, {
        page: safetyCounter,
        requestedPageToken,
        responseNextPageToken,
        accumulatedCount: allRecords.length
      });

      recordsToAppend = decision.recordsToAppend ?? pageRecords;
      deferredRecords = decision.deferredRecords ?? deferredRecords;
      shouldStop = !!decision.stop;
      if (decision.resumeNextPageToken !== undefined) {
        resumeNextPageToken = decision.resumeNextPageToken;
      }
    }

    allRecords.push(...recordsToAppend);

    const elapsed = Date.now() - pageStart;
    pageTimes.push(elapsed);
    pageStart = Date.now();
    const avgMsPerPage = pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length;

    onProgress?.({
      fetched: allRecords.length,
      page: safetyCounter,
      hasMore: shouldStop ? !!resumeNextPageToken : !!responseNextPageToken,
      lastPageCount: recordsToAppend.length,
      avgMsPerPage,
    });

    if (shouldStop) {
      return {
        records: allRecords,
        deferredRecords,
        nextPageToken: resumeNextPageToken,
        completed: false
      };
    }

    nextPageToken = responseNextPageToken;
  } while (nextPageToken && safetyCounter < 250);

  return {
    records: allRecords,
    deferredRecords,
    nextPageToken: nextPageToken || null,
    completed: !nextPageToken
  };
}

async function fetchProcessedTimepieceDataWithMeta(
  options: FetchTimepieceOptions = {}
): Promise<ProcessedTimepieceResult> {
  const result = await fetchTimepieceRecords(options);
  const data = transformIssues(result.records);
  const deferredData = transformIssues(result.deferredRecords);

  if (result.completed) {
    writeCachedDataset(data, options);
  }

  return {
    data,
    deferredData,
    nextPageToken: result.nextPageToken,
    completed: result.completed
  };
}

export async function fetchProcessedTimepieceData(
  options: FetchTimepieceOptions = {}
): Promise<IssueRecord[]> {
  const result = await fetchProcessedTimepieceDataWithMeta(options);
  return result.data;
}

export async function fetchCycleTimeData(
  onProgress?: (p: FetchProgress) => void
): Promise<{ data: IssueRecord[]; source: TimepieceDataSource; error?: string }> {
  try {
    const data = await fetchProcessedTimepieceData({ onProgress });
    return { data, source: 'api' };
  } catch (error) {
    const cachedData = readCachedDataset();
    if (cachedData) {
      return {
        data: cachedData,
        source: 'cache',
        error: error instanceof Error
          ? `${error.message} Showing cached data from the last successful load.`
          : 'Unable to refresh live data. Showing cached data from the last successful load.'
      };
    }

    return {
      data: transformIssues(mockIssues),
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown API error'
    };
  }
}

export async function fetchMemberDataset(): Promise<IssueRecord[]> {
  try {
    return await fetchProcessedTimepieceData({ dataset: 'members' });
  } catch (error) {
    const cachedData = readCachedDataset({ dataset: 'members' });
    if (cachedData) return cachedData;
    throw error;
  }
}

export function getCachedTimepieceData(
  options: Pick<FetchTimepieceOptions, 'dataset' | 'paramSetId'> = {}
): IssueRecord[] | null {
  return readCachedDataset(options);
}

function isCurrentYearRecord(record: RawIssue | IssueRecord, currentYear: number): boolean {
  const resolvedYear =
    typeof record['Resolved.Year'] === 'number'
      ? record['Resolved.Year']
      : toDateOrNull(record.Resolved)?.getFullYear() ?? null;

  return resolvedYear === currentYear;
}

export async function fetchCurrentYearCycleTimeData(
  currentYear: number,
  onProgress?: (p: FetchProgress) => void
): Promise<{
  data: IssueRecord[];
  deferredHistoricalData: IssueRecord[];
  source: TimepieceDataSource;
  error?: string;
  nextPageToken: string | null;
  completed: boolean;
}> {
  try {
    let seenCurrentYear = false;

    const result = await fetchProcessedTimepieceDataWithMeta({
      onProgress,
      pageProcessor: (pageRecords, context) => {
        const currentYearRecords = pageRecords.filter((record) => isCurrentYearRecord(record, currentYear));
        const olderRecords = pageRecords.filter((record) => !isCurrentYearRecord(record, currentYear));
        if (currentYearRecords.length > 0) {
          seenCurrentYear = true;
        }

        const stop =
          (seenCurrentYear && currentYearRecords.length === 0) ||
          (currentYearRecords.length > 0 && olderRecords.length > 0);

        return {
          recordsToAppend: currentYearRecords,
          deferredRecords: currentYearRecords.length > 0 && olderRecords.length > 0 ? olderRecords : undefined,
          stop,
          resumeNextPageToken:
            currentYearRecords.length > 0 && olderRecords.length > 0
              ? context.responseNextPageToken
              : stop
                ? context.requestedPageToken
                : context.responseNextPageToken
        };
      }
    });

    return {
      data: result.data,
      deferredHistoricalData: result.deferredData,
      source: 'api',
      nextPageToken: result.nextPageToken,
      completed: result.completed
    };
  } catch (error) {
    const cachedData = readCachedDataset();
    if (cachedData) {
      return {
        data: cachedData.filter((record) => isCurrentYearRecord(record, currentYear)),
        deferredHistoricalData: [],
        source: 'cache',
        error: error instanceof Error
          ? `${error.message} Showing cached current-year data from the last successful load.`
          : 'Unable to refresh live data. Showing cached current-year data from the last successful load.',
        nextPageToken: null,
        completed: true
      };
    }

    return {
      data: transformIssues(mockIssues).filter((record) => isCurrentYearRecord(record, currentYear)),
      deferredHistoricalData: [],
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown API error',
      nextPageToken: null,
      completed: true
    };
  }
}

export async function fetchHistoricalCycleTimeData(
  startingNextPageToken: string,
  currentYear: number
): Promise<IssueRecord[]> {
  try {
    const result = await fetchProcessedTimepieceDataWithMeta({ initialNextPageToken: startingNextPageToken });
    return result.data;
  } catch (error) {
    const cachedData = readCachedDataset();
    if (cachedData) {
      return cachedData.filter((record) => !isCurrentYearRecord(record, currentYear));
    }

    throw error;
  }
}
