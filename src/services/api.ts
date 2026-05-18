import { IssueRecord, RawIssue } from '../types';
import { transformIssues } from '../utils/transform';
import { mockIssues } from './mockData';

export async function fetchCycleTimeData(): Promise<{ data: IssueRecord[]; source: 'api' | 'mock'; error?: string }> {
  try {
    const response = await fetch('/api/timepiece/cycle-time');
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Unable to fetch cycle-time data.');
    return { data: transformIssues(json.records as RawIssue[]), source: 'api' };
  } catch (error) {
    return {
      data: transformIssues(mockIssues),
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown API error'
    };
  }
}
