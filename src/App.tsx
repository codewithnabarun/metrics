import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCcw } from 'lucide-react';
import type { IssueRecord } from './types';

import { fetchCycleTimeData, fetchMemberDataset, FetchProgress } from './services/api';
import { applyFilters, emptyFilters, Filters, getOptions } from './utils/filters';
import { average, median, round2 } from './utils/transform';
import { MultiSelect } from './components/MultiSelect';
import { KpiCard } from './components/KpiCard';
import { AverageCycleLine, BlockedByTeamBar, BlockedPctLine, ItemsWorkedByMemberBar, MedianCycleLine, StoriesCompletedByTeamBar, TeamHealthScatter, TeamHeatmap } from './components/Charts';
import './styles.css';

function downloadCsv(records: Array<Record<string, unknown>>, filenamePrefix: string) {
  if (records.length === 0) return;

  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return text.includes(',') || text.includes('"') || text.includes('\n')
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };

  const lines = [
    columns.join(','),
    ...records.map((record) => columns.map((column) => escape(record[column])).join(','))
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function enrichMemberData(memberRows: IssueRecord[], cycleRows: IssueRecord[]): IssueRecord[] {
  const cycleByKey = new Map(
    cycleRows
      .filter((row): row is IssueRecord & { Key: string } => typeof row.Key === 'string' && row.Key.length > 0)
      .map((row) => [row.Key, row] as const)
  );

  return memberRows.map((row) => {
    const key = typeof row.Key === 'string' ? row.Key : undefined;
    const cycleRow = key ? cycleByKey.get(key) : undefined;
    if (!cycleRow) return row;

    return {
      ...row,
      Key: cycleRow.Key,
      Project: cycleRow.Project,
      Team: cycleRow.Team,
      'Issue Type': cycleRow['Issue Type'],
      Resolved: cycleRow.Resolved,
      'Resolved.Year': cycleRow['Resolved.Year'],
      'Resolved.Quarter': cycleRow['Resolved.Quarter'],
      'Resolved.MonthNo': cycleRow['Resolved.MonthNo'],
      'Resolved.Month': cycleRow['Resolved.Month'],
      YearMonthLabel: cycleRow.YearMonthLabel,
    };
  });
}

function mergeMembersIntoCycleData(cycleRows: IssueRecord[], memberRows: IssueRecord[]): IssueRecord[] {
  const membersByKey = new Map(
    memberRows
      .filter(
        (row): row is IssueRecord & { Key: string; Members: string } =>
          typeof row.Key === 'string' &&
          row.Key.length > 0 &&
          typeof row.Members === 'string' &&
          row.Members.trim().length > 0
      )
      .map((row) => [row.Key, row.Members] as const)
  );

  return cycleRows.map((row) => {
    const key = typeof row.Key === 'string' ? row.Key : undefined;
    const members = key ? membersByKey.get(key) : undefined;
    return members ? { ...row, Members: members } : row;
  });
}

function App() {
  const [data, setData] = useState<IssueRecord[]>([]);
  const [memberData, setMemberData] = useState<IssueRecord[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [error, setError] = useState<string | undefined>();
  const [memberError, setMemberError] = useState<string | undefined>();
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      if (startTimeRef.current != null) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(id);
  }, [loading]);

  async function loadData() {
    setLoading(true);
    setError(undefined);
    setMemberError(undefined);
    setProgress(null);
    setElapsed(0);
    startTimeRef.current = Date.now();

    const [cycleResult, memberResult] = await Promise.allSettled([
      fetchCycleTimeData((nextProgress) => setProgress(nextProgress)),
      fetchMemberDataset()
    ]);

    if (cycleResult.status === 'fulfilled') {
      const memberRows = memberResult.status === 'fulfilled' ? memberResult.value : [];
      setData(mergeMembersIntoCycleData(cycleResult.value.data, memberRows));
      setSource(cycleResult.value.source);
      setError(cycleResult.value.error);
    } else {
      setData([]);
      setSource('mock');
      setError(cycleResult.reason instanceof Error ? cycleResult.reason.message : 'Unknown API error');
    }

    if (memberResult.status === 'fulfilled') {
      const cycleRows = cycleResult.status === 'fulfilled' ? cycleResult.value.data : [];
      setMemberData(enrichMemberData(memberResult.value, cycleRows));
    } else {
      setMemberData([]);
      setMemberError(memberResult.reason instanceof Error ? memberResult.reason.message : 'Unable to load member dataset.');
    }

    setLoading(false);
    setProgress(null);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const options = useMemo(() => getOptions(data), [data]);
  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const filteredMemberData = useMemo(() => applyFilters(memberData, filters), [memberData, filters]);
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
        <div className="header-actions">
          <button
            className="download"
            onClick={() => downloadCsv(filtered, 'cycle-time')}
            disabled={filtered.length === 0}
          >
            <Download size={18} />
            Download CSV ({filtered.length})
          </button>
          <button className="refresh" onClick={loadData} disabled={loading}>
            <RefreshCcw size={18} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      {loading && (
        <div className="loader-overlay">
          <div className="loader-card">
            <div className="loader-bar-wrap"><div className="loader-bar" /></div>
            <p className="loader-title">Loading Timepiece Data...</p>
            <div className="loader-count">{progress ? progress.fetched.toLocaleString() : '-'}</div>
            <p className="loader-label">records fetched</p>
            <div className="loader-stats">
              {progress ? (
                <>
                  <span className="loader-stat">Page {progress.page}</span>
                  <span className="loader-sep">.</span>
                  <span className="loader-stat">{elapsed}s elapsed</span>
                  <span className="loader-sep">.</span>
                  <span className="loader-stat">~{Math.round(progress.fetched / Math.max(elapsed, 1)).toLocaleString()} rec/s</span>
                  {progress.hasMore && progress.avgMsPerPage > 0 && (
                    <>
                      <span className="loader-sep">.</span>
                      <span className="loader-stat">~{Math.ceil(progress.avgMsPerPage / 1000)}s/page avg</span>
                    </>
                  )}
                </>
              ) : (
                <span className="loader-stat">Initializing...</span>
              )}
            </div>
            {progress?.hasMore && (
              <p className="loader-sub">Fetching next page...</p>
            )}
            {progress && !progress.hasMore && (
              <p className="loader-sub">Processing data...</p>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <>
          {source === 'mock' && error && <div className="warning">{error}</div>}
          {memberError && <div className="warning">{memberError}</div>}

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

          <section className="grid one">
            <ItemsWorkedByMemberBar data={filteredMemberData} />
          </section>

          <section className="grid one">
            <StoriesCompletedByTeamBar data={filtered} />
          </section>
        </>
      )}
    </main>
  );
}

export default App;
