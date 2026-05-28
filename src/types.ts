export type RawIssue = Record<string, unknown>;

export interface IssueRecord extends Record<string, unknown> {
  Key?: string;
  Members?: string;
  Project?: string | null;
  Team?: string;
  'Issue Type'?: string;
  Resolved?: string | null;
  'Resolved.Year'?: number | null;
  'Resolved.Quarter'?: string | null;
  'Resolved.MonthNo'?: number | null;
  'Resolved.Month'?: string | null;
  YearMonthLabel?: string | null;
  'Exe.CycleTime': number;
  'Blocked.CycleTime': number;
  Blocked: number;
  'On Hold': number;
  Feedback: number;
  Waiting: number;
}

export interface OptionSet {
  years: string[];
  quarters: string[];
  months: string[];
  teams: string[];
  issueTypes: string[];
}
