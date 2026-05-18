import { ChevronDown, X } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ label, options, value, onChange, placeholder = 'All' }: Props) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((x) => x !== option) : [...value, option]);
  }

  return (
    <details className="filter">
      <summary>
        <span className="filter-label">{label}</span>
        <span className="filter-value">{value.length ? `${value.length} selected` : placeholder}</span>
        <ChevronDown size={18} />
      </summary>
      <div className="filter-menu">
        <button className="clear-btn" onClick={() => onChange([])} type="button"><X size={14} /> Clear</button>
        {options.map((option) => (
          <label key={option} className="check-row">
            <input type="checkbox" checked={value.includes(option)} onChange={() => toggle(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
