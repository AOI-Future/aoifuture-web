import { useRef, useEffect, useCallback } from 'react';

interface Props {
  analyser: AnalyserNode | null;
  color?: string;
  height?: number;
  active?: boolean;
}

export default function WaveformCanvas({
  analyser,
  color = '#00ffff',
  height = 120,
  active = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || !active) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufLen = analyser.fftSize;
    const data = new Float32Array(bufLen);
    analyser.getFloatTimeDomainData(data);

    const w = canvas.width;
    const h = canvas.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Resize canvas if needed
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width * dpr;
    const ch = rect.height * dpr;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    ctx.clearRect(0, 0, w, h);

    // Draw waveform
    ctx.strokeStyle = color;
    ctx.lineWidth = dpr;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();

    const sliceWidth = w / bufLen;
    let x = 0;

    for (let i = 0; i < bufLen; i++) {
      const v = data[i];
      const y = (v + 1) / 2 * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.stroke();

    // Glow effect
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = dpr * 3;
    ctx.stroke();
    ctx.globalAlpha = 1;

    rafRef.current = requestAnimationFrame(draw);
  }, [analyser, color, active]);

  useEffect(() => {
    if (active && analyser) {
      rafRef.current = requestAnimationFrame(draw);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, active, analyser]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className="w-full bg-black/40 border border-cyan-400/10"
    />
  );
}
