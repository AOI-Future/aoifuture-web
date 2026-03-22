interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function ToggleSwitch({ label, checked, onChange }: Props) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 min-h-[44px] cursor-pointer group"
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span className="text-cyan-400/60 font-mono text-xs tracking-wider group-hover:text-cyan-400/80 transition-colors">
        {label}
      </span>
      <span
        className={`
          font-mono text-xs px-2 py-1 border transition-all duration-200
          ${
            checked
              ? 'border-cyan-400/50 text-cyan-400 bg-cyan-400/10'
              : 'border-cyan-400/20 text-cyan-400/40'
          }
        `}
      >
        {checked ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
