import { IssueRecord, RawIssue } from '../types';
import { addMembersColumn, transformIssues } from '../utils/transform';
import { mockIssues } from './mockData';

export type FetchProgress = {
  fetched: number;
  page: number;
  hasMore: boolean;
  lastPageCount: number;
  avgMsPerPage: number;
};

export type TimepieceDataset = 'default' | 'members';

type FetchTimepieceOptions = {
  dataset?: TimepieceDataset;
  paramSetId?: string;
  onProgress?: (p: FetchProgress) => void;
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

export async function fetchTimepieceRecords({
  dataset = 'default',
  paramSetId,
  onProgress
}: FetchTimepieceOptions = {}): Promise<RawIssue[]> {
  const allRecords: RawIssue[] = [];
  let nextPageToken: string | null = null;
  let safetyCounter = 0;
  const pageTimes: number[] = [];
  let pageStart = Date.now();

  do {
    const response = await fetch(buildTimepieceUrl(nextPageToken, { dataset, paramSetId }));
    let json: Record<string, unknown>;
    try {
      json = await response.json();
    } catch {
      throw new Error(`Server returned an invalid response (HTTP ${response.status}). The function may have timed out - check server logs.`);
    }
    if (!response.ok) throw new Error((json.error as string) || `HTTP ${response.status}`);

    const pageRecords = Array.isArray(json.records) ? (json.records as RawIssue[]) : [];
    allRecords.push(...pageRecords);
    nextPageToken = (json.nextPageToken as string | null) || null;
    safetyCounter++;

    const elapsed = Date.now() - pageStart;
    pageTimes.push(elapsed);
    pageStart = Date.now();
    const avgMsPerPage = pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length;

    onProgress?.({
      fetched: allRecords.length,
      page: safetyCounter,
      hasMore: !!nextPageToken,
      lastPageCount: pageRecords.length,
      avgMsPerPage,
    });
  } while (nextPageToken && safetyCounter < 250);

  return allRecords.map((record) => addMembersColumn(record));
}

export async function fetchProcessedTimepieceData(
  options: FetchTimepieceOptions = {}
): Promise<IssueRecord[]> {
  const records = await fetchTimepieceRecords(options);
  return transformIssues(records);
}

export async function fetchCycleTimeData(
  onProgress?: (p: FetchProgress) => void
): Promise<{ data: IssueRecord[]; source: 'api' | 'mock'; error?: string }> {
  try {
    const data = await fetchProcessedTimepieceData({ onProgress });
    return { data, source: 'api' };
  } catch (error) {
    return {
      data: transformIssues(mockIssues),
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown API error'
    };
  }
}

export async function fetchMemberDataset(): Promise<IssueRecord[]> {
  return fetchProcessedTimepieceData({ dataset: 'members' });
}
