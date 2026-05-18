import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReactNode } from 'react';
import { IssueRecord } from '../types';
import { average, groupBy, median, round2 } from '../utils/transform';

export function buildMonthlyRows(data: IssueRecord[]) {
  return [...groupBy(data, (d) => d.YearMonthLabel).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rows]) => ({
      month,
      avgCycleTime: round2(average(rows.map((r) => r['Exe.CycleTime']))),
      medianCycleTime: round2(median(rows.map((r) => r['Exe.CycleTime']))),
      blockedTimePct: round2(average(rows.map((r) => r['Exe.CycleTime'] ? r['Blocked.CycleTime'] / r['Exe.CycleTime'] : 0)))
    }));
}

export function buildTeamRows(data: IssueRecord[]) {
  return [...groupBy(data, (d) => String(d.Team ?? 'Unknown')).entries()]
    .map(([team, rows]) => ({
      team,
      medianCycleTime: round2(median(rows.map((r) => r['Exe.CycleTime']))),
      avgCycleTime: round2(average(rows.map((r) => r['Exe.CycleTime']))),
      blockedTimePct: round2(average(rows.map((r) => r['Exe.CycleTime'] ? r['Blocked.CycleTime'] / r['Exe.CycleTime'] : 0)))
    }))
    .sort((a, b) => b.blockedTimePct - a.blockedTimePct);
}

function ChartFrame({ title, children }: { title: string; children: ReactNode }) {
  return <section className="chart-card"><h2>{title}</h2><div className="chart-body">{children}</div></section>;
}

export function AverageCycleLine({ data }: { data: IssueRecord[] }) {
  return <ChartFrame title="Average Cycle Time by Months"><ResponsiveContainer><ComposedChart data={buildMonthlyRows(data)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="avgCycleTime" name="Avg Cycle Time" strokeWidth={3} dot={false} /></ComposedChart></ResponsiveContainer></ChartFrame>;
}

export function MedianCycleLine({ data }: { data: IssueRecord[] }) {
  return <ChartFrame title="Median Cycle Time by Months"><ResponsiveContainer><ComposedChart data={buildMonthlyRows(data)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="medianCycleTime" name="Median Cycle Time" strokeWidth={3} dot={false} /></ComposedChart></ResponsiveContainer></ChartFrame>;
}

export function BlockedPctLine({ data }: { data: IssueRecord[] }) {
  return <ChartFrame title="Blocked Time % by Months"><ResponsiveContainer><ComposedChart data={buildMonthlyRows(data)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => `${Number(v).toFixed(2)}`} /><Line type="monotone" dataKey="blockedTimePct" name="Blocked Time %" strokeWidth={3} dot={false} /></ComposedChart></ResponsiveContainer></ChartFrame>;
}

export function TeamHealthScatter({ data }: { data: IssueRecord[] }) {
  return <ChartFrame title="Team Health: Median Cycle Time vs Blocked Time"><ResponsiveContainer><ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="medianCycleTime" name="Median Cycle Time" type="number" /><YAxis dataKey="blockedTimePct" name="Blocked Time %" type="number" /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Scatter name="Teams" data={buildTeamRows(data)} /></ScatterChart></ResponsiveContainer></ChartFrame>;
}

export function BlockedByTeamBar({ data }: { data: IssueRecord[] }) {
  return <ChartFrame title="Teams by Blocked Time %"><ResponsiveContainer><BarChart data={buildTeamRows(data).slice(0, 10)} layout="vertical" margin={{ left: 80 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="team" width={120} /><Tooltip /><Bar dataKey="blockedTimePct" name="Blocked Time %" /></BarChart></ResponsiveContainer></ChartFrame>;
}

export function TeamHeatmap({ data }: { data: IssueRecord[] }) {
  const months = [...new Set(data.map((d) => d.YearMonthLabel).filter(Boolean))].sort() as string[];
  const teamRows = [...groupBy(data, (d) => String(d.Team ?? 'Unknown')).entries()].map(([team, rows]) => {
    const byMonth = groupBy(rows, (d) => d.YearMonthLabel);
    return { team, values: months.map((m) => round2(median((byMonth.get(m) ?? []).map((r) => r['Exe.CycleTime'])))) };
  });
  const max = Math.max(1, ...teamRows.flatMap((r) => r.values));
  return (
    <section className="chart-card heatmap-card">
      <h2>Team Median Cycle Time Heatmap</h2>
      <div className="heatmap-scroll">
        <table className="heatmap"><thead><tr><th>Team</th>{months.map((m) => <th key={m}>{m}</th>)}</tr></thead><tbody>{teamRows.map((row) => <tr key={row.team}><td>{row.team}</td>{row.values.map((value, i) => <td key={months[i]}><span className="heat-cell" style={{ opacity: 0.22 + (value / max) * 0.68 }}>{value ? value.toFixed(2) : '-'}</span></td>)}</tr>)}</tbody></table>
      </div>
    </section>
  );
}
