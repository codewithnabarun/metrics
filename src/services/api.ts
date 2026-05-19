import { IssueRecord, RawIssue } from '../types';
import { transformIssues } from '../utils/transform';
import { mockIssues } from './mockData';

export async function fetchCycleTimeData(): Promise<{ data: IssueRecord[]; source: 'api' | 'mock'; error?: string }> {
  try {
    const response = await fetch('/api/timepiece/cycle-time');
    let json: Record<string, unknown>;
    try {
      json = await response.json();
    } catch {
      const status = response.status;
      throw new Error(`Server returned an invalid response (HTTP ${status}). The function may have timed out — check Netlify function logs.`);
    }
    if (!response.ok) throw new Error((json.error as string) || `HTTP ${response.status}`);
    return { data: transformIssues(json.records as RawIssue[]), source: 'api' };
  } catch (error) {
    return {
      data: transformIssues(mockIssues),
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown API error'
    };
  }
}
