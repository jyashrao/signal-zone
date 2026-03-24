import { useEffect, useRef } from "react";
import { getCursor } from "../engine/signalTrail";
import { signalField } from "../engine/SignalField";
import type { SignalTrend } from "../engine/TrendAnalyzer";

interface Props {
  nqi: number;
  trend?: SignalTrend;
  heading?: number;
}

export default function BackgroundCanvas({ nqi, heading = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    const getHexColor = (val: number) => {
      if (val >= 70) return "#00ff78"; // Green
      if (val >= 40) return "#ffc800"; // Yellow
      return "#ff5050"; // Red
    };

    const render = () => {
      // 1. Clear Screen
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Map Dimensions
      const grid = signalField.getGrid();
      const { rows, cols } = signalField.getDimensions();
      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;

      // 3. Render Visited Grid Cells
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r][c];
          if (!cell.visited) continue;

          ctx.fillStyle = getHexColor(cell.avgNqi);
          // Draw with 1px gap for grid feel
          ctx.fillRect(c * cellW + 0.5, r * cellH + 0.5, cellW - 1, cellH - 1);
        }
      }

      // 4. Render BEST Signal Highlight
      const best = signalField.getBestSignal();
      if (best && best.nqi > 0) {
        const bX = (best.c + 0.5) * cellW;
        const bY = (best.r + 0.5) * cellH;
        
        // Pulsing Gold Glow
        const pulse = Math.sin(Date.now() / 400) * 5;
        const radius = Math.max(cellW, cellH) * 1.2 + pulse;
        
        const bestGlow = ctx.createRadialGradient(bX, bY, 0, bX, bY, radius);
        bestGlow.addColorStop(0, "rgba(255, 215, 0, 0.6)");
        bestGlow.addColorStop(1, "rgba(255, 215, 0, 0)");
        
        ctx.fillStyle = bestGlow;
        ctx.beginPath();
        ctx.arc(bX, bY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Small gold core star/dot
        ctx.fillStyle = "#ffd700";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ffd700";
        ctx.beginPath();
        ctx.arc(bX, bY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 5. Render User Position Pointer
      const cursor = getCursor();
      const curX = cursor.x * canvas.width;
      const curY = cursor.y * canvas.height;

      // Outer glow for pointer
      const glow = ctx.createRadialGradient(curX, curY, 0, curX, curY, 20);
      glow.addColorStop(0, "rgba(255, 255, 255, 0.4)");
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(curX, curY, 20, 0, Math.PI * 2);
      ctx.fill();

      // Main pointer circle
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ffffff";
      ctx.beginPath();
      ctx.arc(curX, curY, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // 5. Render Directional Arrow
      ctx.save();
      ctx.translate(curX, curY);
      
      // Corrected rotation: Invert the heading to match physical phone movement
      // Heading 0 is North/Up, but Canvas 0 is Right/X+.
      // Subtract PI/2 to align "Forward" with the top of the screen.
      const correctedHeading = -heading;
      ctx.rotate(correctedHeading - Math.PI / 2);
      
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(12, 0);      // Tip
      ctx.lineTo(0, -5);      // Top back
      ctx.lineTo(2, 0);       // Inner back
      ctx.lineTo(0, 5);       // Bottom back
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Reset shadow
      ctx.shadowBlur = 0;

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [nqi, heading]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
}
