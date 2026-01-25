import { useEffect, useRef, useCallback } from 'react';

const CELL_SIZE = 8;
const COLORS = {
  bg: '#000000',
  cell: ['#00ffff', '#00e5ff', '#8b5cf6', '#a855f7', '#ff00ff'],
};

export default function LifeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<boolean[][]>([]);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1, y: -1, active: false });
  const gyroRef = useRef({ x: 0, y: 0 });

  const initGrid = useCallback((cols: number, rows: number) => {
    const grid: boolean[][] = [];
    for (let i = 0; i < cols; i++) {
      grid[i] = [];
      for (let j = 0; j < rows; j++) {
        grid[i][j] = Math.random() < 0.1;
      }
    }
    return grid;
  }, []);

  const countNeighbors = (grid: boolean[][], x: number, y: number, cols: number, rows: number) => {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        const nx = (x + i + cols) % cols;
        const ny = (y + j + rows) % rows;
        if (grid[nx][ny]) count++;
      }
    }
    return count;
  };

  const nextGeneration = (grid: boolean[][], cols: number, rows: number) => {
    const next: boolean[][] = [];
    for (let i = 0; i < cols; i++) {
      next[i] = [];
      for (let j = 0; j < rows; j++) {
        const neighbors = countNeighbors(grid, i, j, cols, rows);
        if (grid[i][j]) {
          next[i][j] = neighbors === 2 || neighbors === 3;
        } else {
          next[i][j] = neighbors === 3;
        }
      }
    }
    return next;
  };

  const spawnCells = (grid: boolean[][], x: number, y: number, cols: number, rows: number) => {
    const patterns = [
      [[0, 0], [1, 0], [2, 0]], // Blinker
      [[0, 0], [1, 0], [2, 0], [2, 1], [1, 2]], // Glider
      [[0, 0], [1, 0], [0, 1], [1, 1]], // Block
    ];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];

    pattern.forEach(([dx, dy]) => {
      const nx = (x + dx + cols) % cols;
      const ny = (y + dy + rows) % rows;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        grid[nx][ny] = true;
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const cols = Math.ceil(canvas.width / CELL_SIZE);
      const rows = Math.ceil(canvas.height / CELL_SIZE);
      gridRef.current = initGrid(cols, rows);
    };

    resize();
    window.addEventListener('resize', resize);

    // Mouse/Touch handlers
    const handleMove = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((clientX - rect.left) / CELL_SIZE);
      const y = Math.floor((clientY - rect.top) / CELL_SIZE);

      if (mouseRef.current.active || true) {
        const cols = Math.ceil(canvas.width / CELL_SIZE);
        const rows = Math.ceil(canvas.height / CELL_SIZE);
        if (x >= 0 && x < cols && y >= 0 && y < rows) {
          spawnCells(gridRef.current, x, y, cols, rows);
        }
      }
      mouseRef.current.x = x;
      mouseRef.current.y = y;
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

    // Gyroscope (mobile)
    const handleOrientation = (e: DeviceOrientationEvent) => {
      gyroRef.current.x = (e.gamma || 0) / 90;
      gyroRef.current.y = (e.beta || 0) / 180;
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    // Animation loop
    let frameCount = 0;
    const animate = () => {
      const cols = Math.ceil(canvas.width / CELL_SIZE);
      const rows = Math.ceil(canvas.height / CELL_SIZE);

      // Update every 6 frames (~10 generations per second at 60fps)
      if (frameCount % 6 === 0) {
        gridRef.current = nextGeneration(gridRef.current, cols, rows);
      }

      // Apply gyro effect - shift cells occasionally
      if (frameCount % 30 === 0 && (Math.abs(gyroRef.current.x) > 0.1 || Math.abs(gyroRef.current.y) > 0.1)) {
        const shiftX = Math.sign(gyroRef.current.x);
        const shiftY = Math.sign(gyroRef.current.y);
        const newGrid: boolean[][] = [];
        for (let i = 0; i < cols; i++) {
          newGrid[i] = [];
          for (let j = 0; j < rows; j++) {
            const srcX = (i - shiftX + cols) % cols;
            const srcY = (j - shiftY + rows) % rows;
            newGrid[i][j] = gridRef.current[srcX]?.[srcY] || false;
          }
        }
        gridRef.current = newGrid;
      }

      // Draw
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (gridRef.current[i]?.[j]) {
            const colorIndex = (i + j + frameCount) % COLORS.cell.length;
            ctx.fillStyle = COLORS.cell[colorIndex];
            ctx.shadowBlur = 8;
            ctx.shadowColor = COLORS.cell[colorIndex];
            ctx.fillRect(
              i * CELL_SIZE + 1,
              j * CELL_SIZE + 1,
              CELL_SIZE - 2,
              CELL_SIZE - 2
            );
          }
        }
      }
      ctx.shadowBlur = 0;

      frameCount++;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('deviceorientation', handleOrientation);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initGrid]);

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
