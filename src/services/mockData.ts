import { RawIssue } from '../types';

const teams = ['App Team 1', 'App Team 2', 'App Team 3', 'App Team 4', 'App LMTD Team 2'];
const issueTypes = ['Story', 'Bug', 'Task'];
const months = ['2025-12-18', '2026-01-17', '2026-02-20', '2026-03-16', '2026-04-18', '2026-05-22'];

export const mockIssues: RawIssue[] = Array.from({ length: 90 }, (_, i) => {
  const team = teams[i % teams.length];
  const date = months[i % months.length];
  const base = 2.8 + (i % 8) * 0.35 + (team.endsWith('3') ? 1 : 0);
  const blocked = i % 7 === 0 ? 1.2 : i % 5 === 0 ? 0.5 : 0.05;
  return {
    Key: `APP-${1000 + i}`,
    Team: team,
    'Issue Type': issueTypes[i % issueTypes.length],
    Resolved: date,
    Created: '2025-09-01T00:00:00Z',
    'Story Points': (i % 8) + 1,
    New: 0.2,
    Reopened: 0,
    'To Do': 0.4,
    Backlog: 0.2,
    'PO Elaboration': 0.1,
    'Ready for Estimation': 0.1,
    Groomed: 0.1,
    'In Progress': base,
    Development: 1 + (i % 4) * 0.25,
    Testing: 0.6 + (i % 3) * 0.2,
    Blocked: blocked,
    'On Hold': i % 11 === 0 ? 0.7 : 0,
    Feedback: i % 9 === 0 ? 0.4 : 0,
    Waiting: i % 13 === 0 ? 0.3 : 0,
    'Development Done': 0.2
  };
});
