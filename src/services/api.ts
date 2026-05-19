import { IssueRecord, RawIssue } from '../types';
import { transformIssues } from '../utils/transform';
import { mockIssues } from './mockData';

export async function fetchCycleTimeData(): Promise<{ data: IssueRecord[]; source: 'api' | 'mock'; error?: string }> {
  try {
    const allRecords: RawIssue[] = [];
    let nextPageToken: string | null = null;
    let safetyCounter = 0;

    do {
      const url = nextPageToken
        ? `/api/timepiece/cycle-time?nextPageToken=${encodeURIComponent(nextPageToken)}`
        : '/api/timepiece/cycle-time';

      const response = await fetch(url);
      let json: Record<string, unknown>;
      try {
        json = await response.json();
      } catch {
        throw new Error(`Server returned an invalid response (HTTP ${response.status}). The function may have timed out — check Netlify function logs.`);
      }
      if (!response.ok) throw new Error((json.error as string) || `HTTP ${response.status}`);

      if (Array.isArray(json.records)) allRecords.push(...(json.records as RawIssue[]));
      nextPageToken = (json.nextPageToken as string | null) || null;
      safetyCounter++;
    } while (nextPageToken && safetyCounter < 250);

    return { data: transformIssues(allRecords), source: 'api' };
  } catch (error) {
    return {
      data: transformIssues(mockIssues),
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown API error'
    };
  }
}
