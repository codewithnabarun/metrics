import { IssueRecord, OptionSet } from '../types';

export const ALLOWED_TEAMS = new Set([
  'App LMTD Team 1',
  'App LMTD Team 2',
  'App Team 1',
  'App Team 2',
  'App Team 3',
  'App Team 4',
  'App Team 5',
  'App Team 6',
  'App Team 7',
  'App Team 8',
  'Eng Team 1',
  'Eng Team 2',
  'Eng Team 3',
  'Eng Team 4',
  'STMD Team',
  'CIT'
]);

export interface Filters {
  years: string[];
  quarters: string[];
  months: string[];
  teams: string[];
  issueTypes: string[];
}

export const emptyFilters: Filters = {
  years: [],
  quarters: [],
  months: [],
  teams: [],
  issueTypes: []
};

function uniqueSorted(values: Array<string | number | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string | number => v !== null && v !== undefined && String(v) !== ''))]
    .map(String)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function getOptions(data: IssueRecord[]): OptionSet {
  return {
    years: uniqueSorted(data.map((d) => d['Resolved.Year'])),
    quarters: ['Q1', 'Q2', 'Q3', 'Q4'].filter((q) => data.some((d) => d['Resolved.Quarter'] === q)),
    months: uniqueSorted(data.map((d) => d.YearMonthLabel)),
    teams: uniqueSorted(data.map((d) => String(d.Team ?? 'Unknown')).filter((t) => ALLOWED_TEAMS.has(t))),
    issueTypes: uniqueSorted(data.map((d) => String(d['Issue Type'] ?? 'Unknown')))
  };
}

function includeValue(selected: string[], value: unknown) {
  return selected.length === 0 || selected.includes(String(value ?? 'Unknown'));
}

export function applyFilters(
  data: IssueRecord[],
  filters: Filters,
  options: { enforceAllowedTeams?: boolean } = {}
): IssueRecord[] {
  const { enforceAllowedTeams = true } = options;

  return data.filter((d) =>
    (!enforceAllowedTeams || ALLOWED_TEAMS.has(String(d.Team ?? ''))) &&
    includeValue(filters.years, d['Resolved.Year']) &&
    includeValue(filters.quarters, d['Resolved.Quarter']) &&
    includeValue(filters.months, d.YearMonthLabel) &&
    includeValue(filters.teams, d.Team ?? 'Unknown') &&
    includeValue(filters.issueTypes, d['Issue Type'] ?? 'Unknown')
  );
}
