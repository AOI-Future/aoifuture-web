interface Props {
  what: string;
  listen: string;
  why?: string;
}

/** Contextual guide showing what's happening, what to listen for, and why it matters */
export default function GuideText({ what, listen, why }: Props) {
  return (
    <div className="bg-black/60 border border-cyan-400/15 p-3 space-y-2 text-xs md:text-sm font-[system-ui] leading-relaxed">
      <div className="text-cyan-400/90">
        <span className="font-mono text-[10px] text-cyan-400/40 tracking-wider">WHAT: </span>
        {what}
      </div>
      <div className="text-cyan-400/70">
        <span className="font-mono text-[10px] text-cyan-400/40 tracking-wider">LISTEN: </span>
        {listen}
      </div>
      {why && (
        <div className="text-cyan-400/50 border-t border-cyan-400/10 pt-2 mt-2">
          <span className="font-mono text-[10px] text-cyan-400/30 tracking-wider">WHY: </span>
          {why}
        </div>
      )}
    </div>
  );
}
