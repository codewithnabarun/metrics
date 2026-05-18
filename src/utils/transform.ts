import { IssueRecord, RawIssue } from '../types';

export const STATUS_COLUMNS = [
  'New', 'Reopened', 'To Do', 'Backlog', 'PO Elaboration', 'Ready for Estimation',
  'Groomed', 'In Progress', 'Development', 'Testing', 'Blocked', 'On Hold',
  'Feedback', 'Waiting', 'Development Done'
] as const;

const EXECUTION_COLUMNS = ['In Progress', 'Development', 'Testing', 'Blocked', 'On Hold', 'Feedback', 'Waiting', 'Development Done'] as const;
const BLOCKED_COLUMNS = ['Blocked', 'On Hold', 'Feedback', 'Waiting'] as const;

export function toNumberOrZero(value: unknown): number {
  if (value === null || value === undefined || value === '-') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toDateOrNull(value: unknown): Date | null {
  if (!value || value === '-') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function monthName(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short' });
}

export function transformIssues(records: RawIssue[]): IssueRecord[] {
  return records.map((raw) => {
    const issue: IssueRecord = { ...raw } as IssueRecord;

    for (const col of STATUS_COLUMNS) {
      issue[col] = round2(toNumberOrZero(raw[col]));
    }

    const resolved = toDateOrNull(raw.Resolved);
    issue.Resolved = resolved ? resolved.toISOString().slice(0, 10) : null;
    issue['Resolved.Year'] = resolved ? resolved.getFullYear() : null;
    issue['Resolved.Quarter'] = resolved ? `Q${Math.floor(resolved.getMonth() / 3) + 1}` : null;
    issue['Resolved.MonthNo'] = resolved ? resolved.getMonth() + 1 : null;
    issue['Resolved.Month'] = resolved ? monthName(resolved) : null;
    issue.YearMonthLabel = resolved ? `${resolved.getFullYear()}-${String(resolved.getMonth() + 1).padStart(2, '0')}` : null;

    const key = String(raw.Key ?? raw['Issue Key'] ?? '');
    issue.Key = key || undefined;
    issue.Project = key.includes('-') ? key.split('-')[0] : null;

    issue['Exe.CycleTime'] = round2(EXECUTION_COLUMNS.reduce((sum, col) => sum + toNumberOrZero(issue[col]), 0));
    issue['Blocked.CycleTime'] = round2(BLOCKED_COLUMNS.reduce((sum, col) => sum + toNumberOrZero(issue[col]), 0));

    return issue;
  });
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string | null | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}
