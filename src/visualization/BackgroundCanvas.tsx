import { useEffect, useRef } from "react";
import { KalmanFilter } from "../filters/KalmanFilter";
import { getPoints, getCursor, getBestPoint } from "../engine/signalTrail";
import { signalField } from "../engine/SignalField";
import type { SignalTrend } from "../engine/TrendAnalyzer";

interface Props {
  nqi: number;
  trend?: SignalTrend;
}

export default function BackgroundCanvas({ nqi, trend = "stable" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hueFilter = useRef(new KalmanFilter(0.005, 0.5)); // Very smooth transition for visuals
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

    const getInterpolatedColor = (val: number) => {
      // 70–100 → Green (0, 255, 120)
      // 40–70 → Yellow (255, 200, 0)
      // 0–40 → Red (255, 80, 80)
      if (val >= 70) return "0, 255, 120";
      if (val >= 40) {
        const t = (val - 40) / 30;
        const r = Math.round(255 * (1 - t) + 0 * t);
        const g = Math.round(200 * (1 - t) + 255 * t);
        const b = Math.round(0 * (1 - t) + 120 * t);
        return `${r}, ${g}, ${b}`;
      }
      const t = Math.max(0, val) / 40;
      const r = 255;
      const g = Math.round(80 * (1 - t) + 200 * t);
      const b = Math.round(80 * (1 - t) + 0 * t);
      return `${r}, ${g}, ${b}`;
    };

    const render = () => {
      const now = Date.now();
      const time = now / 1000;
      
      // 1. Logic Update
      signalField.step();

      // Interpolate hue based on nqi
      const targetHue = Math.max(0, Math.min(120, nqi * 1.2));
      const currentHue = hueFilter.current.filter(targetHue);

      // 2. Clear & Base Layer
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)"; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle Background Tint with organic pulse
      const bgPulse = Math.sin(time * 0.5) * 0.03;
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width
      );
      gradient.addColorStop(0, `hsla(${currentHue}, 45%, 12%, ${0.12 + bgPulse})`);
      gradient.addColorStop(1, "hsla(0, 0%, 4%, 0.12)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. Shared Variables for Rendering
      const cursor = getCursor();
      const curX = cursor.x * canvas.width;
      const curY = cursor.y * canvas.height;
      const grid = signalField.getGrid();
      const { rows, cols } = signalField.getDimensions();
      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;
      
      // Base radius for heatmap cells
      const baseRadius = Math.max(cellW, cellH) * 2.8;

      // Use additive blending for signal elements
      ctx.globalCompositeOperation = "lighter";

      // 4. Render Signal Field (Flowing Heatmap)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r][c];
          if (cell.intensity <= 0.01) continue;

          const centerX = (c + 0.5) * cellW;
          const centerY = (r + 0.5) * cellH;

          // A. Organic Drift (Noise-like movement)
          const driftX = Math.sin(time * 0.8 + r * 0.5) * 12;
          const driftY = Math.cos(time * 0.7 + c * 0.5) * 12;

          // B. Trend-based Flow (Expansion/Contraction)
          const dx = centerX - curX;
          const dy = centerY - curY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          let flowX = 0;
          let flowY = 0;
          if (trend !== "stable") {
            const force = (trend === "up" ? 1 : -1) * Math.min(25, 1500 / (dist + 40));
            const flowPulse = Math.sin(time * 2 - dist / 100);
            const angle = Math.atan2(dy, dx);
            flowX = Math.cos(angle) * force * flowPulse;
            flowY = Math.sin(angle) * force * flowPulse;
          }

          // C. Global "Living" Movement (Rising/Sinking)
          const verticalShift = (trend === "up" ? -15 : (trend === "down" ? 10 : 0)) * Math.sin(time);

          const finalX = centerX + driftX + flowX;
          const finalY = centerY + driftY + flowY + verticalShift;

          // D. Ripple Effect (Intensity modulation)
          const rippleScale = trend === "up" ? 1.4 : (trend === "down" ? 0.7 : 1.0);
          const ripple = Math.sin(dist / 50 - time * 4) * (0.08 * rippleScale);
          
          const color = getInterpolatedColor(cell.nqi);
          const alpha = Math.max(0, (cell.intensity + ripple) * (trend === "down" ? 0.25 : 0.4));
          const dynamicRadius = baseRadius * (1 + ripple * 0.3) * (trend === "up" ? 1.1 : 1.0);

          const cellGradient = ctx.createRadialGradient(
            finalX, finalY, 0,
            finalX, finalY, dynamicRadius
          );
          
          cellGradient.addColorStop(0, `rgba(${color}, ${alpha})`);
          cellGradient.addColorStop(0.4, `rgba(${color}, ${alpha * 0.3})`);
          cellGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.fillStyle = cellGradient;
          ctx.fillRect(finalX - dynamicRadius, finalY - dynamicRadius, dynamicRadius * 2, dynamicRadius * 2);
        }
      }

      // 5. Render historical trail - subtle points
      const points = getPoints();
      const life = 12000;

      points.forEach((point) => {
        const age = now - point.timestamp;
        if (age > life) return;

        // Points also drift slightly
        const pDriftX = Math.sin(time + point.y * 10) * 5;
        const pDriftY = Math.cos(time + point.x * 10) * 5;
        
        const x = point.x * canvas.width + pDriftX;
        const y = point.y * canvas.height + pDriftY;
        const alpha = (1 - age / life) * 0.06;
        const color = getInterpolatedColor(point.nqi);
        const pRadius = (15 + (point.nqi / 100) * 30) * (1 + Math.sin(time * 2 + age / 1000) * 0.1);

        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, pRadius);
        glowGradient.addColorStop(0, `rgba(${color}, ${alpha})`);
        glowGradient.addColorStop(1, `rgba(${color}, 0)`);

        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(x, y, pRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 6. Render BEST signal indicator
      const bestPoint = getBestPoint();
      if (bestPoint && bestPoint.nqi > 50) {
        const bX = bestPoint.x * canvas.width;
        const bY = bestPoint.y * canvas.height;
        const pulseVal = Math.sin(time * 3) * 12;
        const outerRadius = 75 + pulseVal;
        
        const bestGradient = ctx.createRadialGradient(bX, bY, 0, bX, bY, outerRadius);
        bestGradient.addColorStop(0, "rgba(0, 255, 120, 0.12)");
        bestGradient.addColorStop(1, "rgba(0, 255, 120, 0)");

        ctx.fillStyle = bestGradient;
        ctx.beginPath();
        ctx.arc(bX, bY, outerRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. Render CURRENT signal glow (User Anchor)
      const curColor = getInterpolatedColor(nqi);
      const trendScale = trend === "up" ? 1.5 : (trend === "down" ? 0.6 : 1.0);
      const pulseFreq = trend === "up" ? 0.15 : (trend === "down" ? 0.8 : 0.4);
      const pulseVal = Math.sin(now / (pulseFreq * 1000)) * (25 * trendScale);
      
      const curRadius = (160 + (nqi / 100) * 220 + pulseVal) * trendScale;
      const curIntensity = trend === "up" ? 0.5 : (trend === "down" ? 0.1 : 0.2);

      const curGradient = ctx.createRadialGradient(curX, curY, 0, curX, curY, curRadius);
      curGradient.addColorStop(0, `rgba(${curColor}, ${curIntensity})`);
      curGradient.addColorStop(0.3, `rgba(${curColor}, ${curIntensity * 0.5})`);
      curGradient.addColorStop(1, `rgba(${curColor}, 0)`);

      ctx.fillStyle = curGradient;
      ctx.beginPath();
      ctx.arc(curX, curY, curRadius, 0, Math.PI * 2);
      ctx.fill();

      // 8. Render USER position anchor (The Core)
      ctx.globalCompositeOperation = "source-over";
      const corePulse = Math.sin(time * 10) * 1;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(curX, curY, 4 + corePulse, 0, Math.PI * 2);
      ctx.fill();

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [nqi, trend]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
}

