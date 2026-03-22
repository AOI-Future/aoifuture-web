import { useState } from 'react';

interface Props {
  text: string;
}

export default function InsightBadge({ text }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-cyan-400/10 pt-2 mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-cyan-400/50 font-mono text-xs tracking-wider hover:text-cyan-400/80 transition-colors cursor-pointer"
      >
        {'>'} INSIGHT {open ? '[-]' : '[+]'}
      </button>
      {open && (
        <div className="mt-2 text-cyan-400/70 text-xs md:text-sm leading-relaxed font-[system-ui] pl-4 border-l border-cyan-400/20">
          {text}
        </div>
      )}
    </div>
  );
}
