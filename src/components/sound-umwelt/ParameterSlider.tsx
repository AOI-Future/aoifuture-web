interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  colorClass?: string;
}

export default function ParameterSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  colorClass = 'accent-cyan-400',
}: Props) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-cyan-400/60 font-mono text-xs tracking-wider">
          {label}
        </span>
        <span className="text-cyan-400 font-mono text-xs">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`
          w-full h-1 bg-cyan-400/20 rounded-none appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:border-0
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:bg-cyan-400 [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer
          ${colorClass}
        `}
        aria-label={label}
      />
    </div>
  );
}
