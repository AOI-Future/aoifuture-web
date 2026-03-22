interface Props<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  colorClass?: string;
}

export default function SelectButtons<T extends string>({
  label,
  options,
  value,
  onChange,
  colorClass = 'border-cyan-400/50 text-cyan-400',
}: Props<T>) {
  return (
    <div className="space-y-2">
      <div className="text-cyan-400/60 font-mono text-xs tracking-wider">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`
              px-3 py-2 font-mono text-xs md:text-sm border transition-all duration-200 cursor-pointer
              min-w-[44px] min-h-[44px] flex items-center justify-center
              ${
                value === opt
                  ? `${colorClass} bg-white/5`
                  : 'border-cyan-400/20 text-cyan-400/50 hover:border-cyan-400/40 hover:text-cyan-400/80'
              }
            `}
          >
            [{opt}]
          </button>
        ))}
      </div>
    </div>
  );
}
