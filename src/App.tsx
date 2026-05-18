import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCcw } from 'lucide-react';
import type { IssueRecord } from './types';

import { fetchCycleTimeData } from './services/api';
import { applyFilters, emptyFilters, Filters, getOptions } from './utils/filters';
import { average, median, round2 } from './utils/transform';
import { MultiSelect } from './components/MultiSelect';
import { KpiCard } from './components/KpiCard';
import { AverageCycleLine, BlockedByTeamBar, BlockedPctLine, MedianCycleLine, TeamHealthScatter, TeamHeatmap } from './components/Charts';
import './styles.css';

function downloadCsv(records: IssueRecord[]) {
  if (records.length === 0) return;
  const columns = Object.keys(records[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    columns.join(','),
    ...records.map((r) => columns.map((c) => escape(r[c])).join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cycle-time-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [data, setData] = useState<IssueRecord[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [error, setError] = useState<string | undefined>();

  async function loadData() {
    setLoading(true);
    const result = await fetchCycleTimeData();
    setData(result.data);
    setSource(result.source);
    setError(result.error);
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  const options = useMemo(() => getOptions(data), [data]);
  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const kpis = useMemo(() => {
    const cycle = filtered.map((d) => d['Exe.CycleTime']);
    const blocked = filtered.map((d) => d['Blocked.CycleTime']);
    const blockedPct = filtered.map((d) => d['Exe.CycleTime'] ? d['Blocked.CycleTime'] / d['Exe.CycleTime'] : 0);
    return {
      avgCycle: round2(average(cycle)),
      medianCycle: round2(median(cycle)),
      avgBlocked: round2(average(blocked)),
      medianBlocked: round2(median(blocked)),
      blockedPct: round2(average(blockedPct))
    };
  }, [filtered]);

  return (
    <main>
      <header className="app-header">
        <div>
          <h1>Cycle Time Report</h1>
          <p>React dashboard backed by Timepiece/Jira data and the Power Query transformation logic.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="download" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}><Download size={18} /> Download CSV ({filtered.length})</button>
          <button className="refresh" onClick={loadData} disabled={loading}><RefreshCcw size={18} /> {loading ? 'Loading...' : 'Refresh'}</button>
        </div>
      </header>

      {source === 'mock' && <div className="warning">Showing sample data. Configure <code>.env</code> with <code>TIS_JWT</code> and restart the server to fetch live Timepiece data. {error}</div>}

      <section className="filters">
        <MultiSelect label="Year" options={options.years} value={filters.years} onChange={(years) => setFilters({ ...filters, years })} />
        <MultiSelect label="Quarter" options={options.quarters} value={filters.quarters} onChange={(quarters) => setFilters({ ...filters, quarters })} />
        <MultiSelect label="Month" options={options.months} value={filters.months} onChange={(months) => setFilters({ ...filters, months })} />
        <MultiSelect label="Team" options={options.teams} value={filters.teams} onChange={(teams) => setFilters({ ...filters, teams })} />
        <MultiSelect label="Issue Type" options={options.issueTypes} value={filters.issueTypes} onChange={(issueTypes) => setFilters({ ...filters, issueTypes })} />
      </section>

      <section className="kpis">
        <KpiCard title="Avg Cycle Time" value={kpis.avgCycle} />
        <KpiCard title="Median Cycle Time" value={kpis.medianCycle} />
        <KpiCard title="Avg Blocked Cycle Time" value={kpis.avgBlocked} />
        <KpiCard title="Median Blocked Cycle Time" value={kpis.medianBlocked} />
        <KpiCard title="Blocked Time %" value={kpis.blockedPct} />
      </section>

      <section className="grid two">
        <AverageCycleLine data={filtered} />
        <MedianCycleLine data={filtered} />
        <BlockedPctLine data={filtered} />
        <TeamHealthScatter data={filtered} />
      </section>

      <section className="grid two lower">
        <TeamHeatmap data={filtered} />
        <BlockedByTeamBar data={filtered} />
      </section>
    </main>
  );
}

export default App;
