import { useRef, useEffect, useCallback } from 'react';

interface Props {
  getFrequencyData: (() => Uint8Array | null) | null;
  color?: string;
  height?: number;
  active?: boolean;
  barCount?: number;
}

export default function SpectrumCanvas({
  getFrequencyData,
  color = '#00ffff',
  height = 100,
  active = true,
  barCount = 32,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !getFrequencyData || !active) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = getFrequencyData();
    if (!data) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width * dpr;
    const ch = rect.height * dpr;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Group frequency bins into bars
    const binsPerBar = Math.floor(data.length / barCount);
    const barWidth = w / barCount;
    const gap = 2 * dpr;

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < binsPerBar; j++) {
        sum += data[i * binsPerBar + j];
      }
      const avg = sum / binsPerBar;
      const barHeight = (avg / 255) * h;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(
        i * barWidth + gap / 2,
        h - barHeight,
        barWidth - gap,
        barHeight,
      );

      // Glow
      ctx.globalAlpha = 0.2;
      ctx.fillRect(
        i * barWidth + gap / 2 - dpr,
        h - barHeight - dpr,
        barWidth - gap + dpr * 2,
        barHeight + dpr * 2,
      );
    }

    ctx.globalAlpha = 1;
    rafRef.current = requestAnimationFrame(draw);
  }, [getFrequencyData, color, active, barCount]);

  useEffect(() => {
    if (active && getFrequencyData) {
      rafRef.current = requestAnimationFrame(draw);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, active, getFrequencyData]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className="w-full bg-black/40 border border-cyan-400/10"
    />
  );
}
