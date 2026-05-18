interface Props {
  title: string;
  value: number | string;
}

export function KpiCard({ title, value }: Props) {
  return (
    <div className="kpi-card">
      <div className="kpi-value">{typeof value === 'number' ? value.toFixed(2) : value}</div>
      <div className="kpi-title">{title}</div>
    </div>
  );
}
