import { useEffect, useRef } from 'react';
import { mulberry32, r2Point, ValueNoise1D } from '../lib/random';

// --- Constants ---
const N = 128;
const R = 12;
const DT = 0.15;
// Lenia growth function parameters (base values, modulated over time)
const MU_BASE = 0.15;
const SIGMA_BASE = 0.025;
const SPONTANEOUS_INTERVAL = 90; // inject a blob every ~90 steps to prevent stagnation

// Colormap: value 0→transparent black, low→deep purple, mid→cyan, high→magenta/white
function valueToRGBA(v: number): [number, number, number, number] {
  if (v < 0.01) return [0, 0, 0, 0];
  const t = Math.min(v, 1);
  // 3-stop gradient: purple(0.0) → cyan(0.5) → magenta(1.0)
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const s = t / 0.5;
    r = Math.round(139 * (1 - s) + 0 * s);       // 139→0
    g = Math.round(92 * (1 - s) + 229 * s);       // 92→229
    b = Math.round(246 * (1 - s) + 255 * s);      // 246→255
  } else {
    const s = (t - 0.5) / 0.5;
    r = Math.round(0 * (1 - s) + 255 * s);        // 0→255
    g = Math.round(229 * (1 - s) + 0 * s);        // 229→0
    b = Math.round(255 * (1 - s) + 255 * s);      // 255→255
  }
  const a = Math.round(Math.min(t * 3, 1) * 255);
  return [r, g, b, a];
}

// Precompute kernel (Gaussian ring)
function buildKernel(): { offsets: Int8Array; weights: Float32Array; count: number } {
  const offsets: number[] = [];
  const weights: number[] = [];
  const peakR = R * 0.5;
  const sigmaK = R * 0.15;
  let sum = 0;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > R || dist < 1) continue;
      const w = Math.exp(-((dist - peakR) ** 2) / (2 * sigmaK * sigmaK));
      if (w < 0.001) continue;
      offsets.push(dx, dy);
      weights.push(w);
      sum += w;
    }
  }
  // Normalize
  const normWeights = new Float32Array(weights.length);
  for (let i = 0; i < weights.length; i++) normWeights[i] = weights[i] / sum;
  return {
    offsets: new Int8Array(offsets),
    weights: normWeights,
    count: weights.length,
  };
}

// Growth function
function growth(u: number, mu: number, sigma: number): number {
  return 2 * Math.exp(-((u - mu) ** 2) / (2 * sigma * sigma)) - 1;
}

// Bilinear interpolation read from grid (toroidal)
function sampleBilinear(grid: Float32Array, out: Float32Array, fx: number, fy: number): Float32Array {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const sx = x - fx;
      const sy = y - fy;
      const x0 = ((Math.floor(sx) % N) + N) % N;
      const y0 = ((Math.floor(sy) % N) + N) % N;
      const x1 = (x0 + 1) % N;
      const y1 = (y0 + 1) % N;
      const dx = sx - Math.floor(sx);
      const dy = sy - Math.floor(sy);
      out[y * N + x] =
        grid[y0 * N + x0] * (1 - dx) * (1 - dy) +
        grid[y0 * N + x1] * dx * (1 - dy) +
        grid[y1 * N + x0] * (1 - dx) * dy +
        grid[y1 * N + x1] * dx * dy;
    }
  }
  return out;
}

// Inject a Gaussian blob at (cx, cy) in grid coordinates
function injectBlob(grid: Float32Array, cx: number, cy: number, radius: number, peak: number) {
  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const gx = ((Math.round(cx) + dx) % N + N) % N;
      const gy = ((Math.round(cy) + dy) % N + N) % N;
      const d2 = dx * dx + dy * dy;
      const v = peak * Math.exp(-d2 / (2 * (radius * 0.4) ** 2));
      const idx = gy * N + gx;
      grid[idx] = Math.min(grid[idx] + v, 1);
    }
  }
}

export default function LifeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Offscreen canvas for 128x128 rendering
    const offscreen = document.createElement('canvas');
    offscreen.width = N;
    offscreen.height = N;
    const offCtx = offscreen.getContext('2d')!;
    const imageData = offCtx.createImageData(N, N);

    // --- Structured randomness ---
    // Session seed: each visit gets its own deterministic universe.
    const seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
    const rand = mulberry32(seed);
    // Independent noise fields for flow direction / strength / turbulence
    const noiseAngle = new ValueNoise1D(seed ^ 0x9e3779b9);
    const noiseFlow = new ValueNoise1D(seed ^ 0x85ebca6b);
    const noiseTurbX = new ValueNoise1D(seed ^ 0xc2b2ae35);
    const noiseTurbY = new ValueNoise1D(seed ^ 0x27d4eb2f);
    // R2 low-discrepancy sequence: blob placement covers the field evenly
    let r2Index = 0;
    const r2Phase: [number, number] = [rand(), rand()];
    const nextBlobPos = (): [number, number] => {
      const [u, v] = r2Point(r2Index++, r2Phase[0], r2Phase[1]);
      return [u * N, v * N];
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Reduced motion: slow the simulation to a gentle drift (~5 steps/sec)
    const simInterval = reducedMotion ? 12 : 3;

    // Double buffer + advection scratch buffer (reused, no per-step alloc)
    let gridA = new Float32Array(N * N);
    let gridB = new Float32Array(N * N);
    const shifted = new Float32Array(N * N);

    // Initialize: low-discrepancy blob placement, seeded sizes
    const initGrid = (grid: Float32Array) => {
      grid.fill(0);
      const numBlobs = 8 + Math.floor(rand() * 8);
      for (let i = 0; i < numBlobs; i++) {
        const [cx, cy] = nextBlobPos();
        const radius = 4 + rand() * 6;
        const peak = 0.5 + rand() * 0.5;
        injectBlob(grid, cx, cy, radius, peak);
      }
    };
    initGrid(gridA);

    // Precomputed kernel
    const kernel = buildKernel();

    // State refs
    let gyroX = 0;
    let gyroY = 0;
    let hasGyro = false;
    let animId = 0;
    let frameCount = 0;
    let canvasW = 0;
    let canvasH = 0;
    let running = true;

    // Resize
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvasW = canvas.width;
      canvasH = canvas.height;
    };
    resize();
    window.addEventListener('resize', resize);

    // Mouse/Touch → grid coords
    const screenToGrid = (clientX: number, clientY: number): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      const gx = ((clientX - rect.left) / rect.width) * N;
      const gy = ((clientY - rect.top) / rect.height) * N;
      return [gx, gy];
    };

    const handleMove = (clientX: number, clientY: number) => {
      const [gx, gy] = screenToGrid(clientX, clientY);
      injectBlob(gridA, gx, gy, 6, 0.9);
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchStart = (e: TouchEvent) => {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart);

    // Gyroscope
    const handleOrientation = (e: DeviceOrientationEvent) => {
      gyroX = (e.gamma || 0) / 25;  // normalized ±1 at 25°
      gyroY = (e.beta || 0) / 25;
      hasGyro = true;
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    // --- Simulation step ---
    let stepCount = 0;
    const step = (time: number) => {
      // Time-varying parameters (breathing) — wider swing to prevent equilibrium
      const t = time * 0.001;
      const mu = MU_BASE + 0.035 * Math.sin(t * 0.7) + 0.02 * Math.sin(t * 1.3) + 0.01 * Math.sin(t * 2.1);
      const sigma = SIGMA_BASE + 0.008 * Math.sin(t * 0.5 + 1.0) + 0.004 * Math.sin(t * 1.7);

      // Spontaneous blob injection to prevent stagnation —
      // placed via low-discrepancy sequence so revivals spread evenly
      stepCount++;
      if (stepCount % SPONTANEOUS_INTERVAL === 0) {
        const [cx, cy] = nextBlobPos();
        injectBlob(gridA, cx, cy, 4 + rand() * 4, 0.4 + rand() * 0.4);
      }

      // Sparse seeded mutations — ~0.3% of cells get a small nudge each step
      const mutationCount = Math.floor(N * N * 0.003);
      for (let m = 0; m < mutationCount; m++) {
        const idx = Math.floor(rand() * N * N);
        gridA[idx] = Math.min(gridA[idx] + 0.05 + rand() * 0.1, 1);
      }

      // Flow vector — direction wanders via smooth noise instead of constant rotation
      let fx: number, fy: number;
      if (hasGyro) {
        fx = gyroX * 2.0;
        fy = gyroY * 2.0;
      } else {
        const angle = noiseAngle.fbm(t * 0.05) * Math.PI * 2;
        const flowStrength = 0.18 + 0.12 * noiseFlow.at(t * 0.1);
        fx = Math.cos(angle) * flowStrength;
        fy = Math.sin(angle) * flowStrength;
      }

      // Turbulence — continuous noise field replaces the old abrupt jolt
      // every 40 steps; swells and ebbs organically, never snaps
      const turbAmp = reducedMotion ? 0 : 0.6 + 0.5 * noiseFlow.at(t * 0.07 + 50);
      const turbX = noiseTurbX.fbm(t * 0.25) * turbAmp;
      const turbY = noiseTurbY.fbm(t * 0.25) * turbAmp;

      // Apply advection (flow shift via bilinear interpolation)
      sampleBilinear(gridA, shifted, fx + turbX, fy + turbY);

      // Convolution + growth
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          let potential = 0;
          for (let k = 0; k < kernel.count; k++) {
            const ox = kernel.offsets[k * 2];
            const oy = kernel.offsets[k * 2 + 1];
            const nx = ((x + ox) % N + N) % N;
            const ny = ((y + oy) % N + N) % N;
            potential += shifted[ny * N + nx] * kernel.weights[k];
          }
          const g = growth(potential, mu, sigma);
          const val = shifted[y * N + x] + DT * g;
          gridB[y * N + x] = Math.max(0, Math.min(1, val));
        }
      }

      // Swap buffers
      const tmp = gridA;
      gridA = gridB;
      gridB = tmp;
    };

    // --- Render ---
    const render = () => {
      const data = imageData.data;
      for (let i = 0; i < N * N; i++) {
        const [r, g, b, a] = valueToRGBA(gridA[i]);
        const j = i * 4;
        data[j] = r;
        data[j + 1] = g;
        data[j + 2] = b;
        data[j + 3] = a;
      }
      offCtx.putImageData(imageData, 0, 0);

      // Clear and upscale
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offscreen, 0, 0, canvasW, canvasH);

      // Glow overlay pass (draw again with globalCompositeOperation for bloom)
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3;
      ctx.filter = 'blur(8px)';
      ctx.drawImage(offscreen, 0, 0, canvasW, canvasH);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    // --- Animation loop ---
    const animate = (time: number) => {
      if (!running) return;

      if (frameCount % simInterval === 0) {
        step(time);
      }

      render();

      // Emit density every 6 frames
      // Scale up density to match AmbientSound's expected range (~0.05-0.25)
      // Lenia average values are typically much lower than boolean GoL
      if (frameCount % 6 === 0) {
        let sum = 0;
        for (let i = 0; i < N * N; i++) sum += gridA[i];
        const rawDensity = sum / (N * N);
        const density = Math.min(rawDensity * 4, 0.35);
        window.dispatchEvent(
          new CustomEvent('lifegame-density', {
            detail: { density, cellCount: Math.round(sum) },
          })
        );
      }

      frameCount++;
      animId = requestAnimationFrame(animate);
    };

    // Pause when tab is hidden — no wasted CPU, sim resumes where it left off
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(animId);
      } else if (!running) {
        running = true;
        animId = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    animId = requestAnimationFrame(animate);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('deviceorientation', handleOrientation);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    />
  );
}
