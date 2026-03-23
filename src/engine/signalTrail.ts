import type { SignalTrend } from "./TrendAnalyzer";
import { signalField } from "./SignalField";

export type SignalPoint = {
  x: number;
  y: number;
  nqi: number;
  trend: SignalTrend;
  timestamp: number;
};

const MAX_POINTS = 200; // Increased to accommodate interpolation density
let points: SignalPoint[] = [];
let cursor = { x: 0.5, y: 0.5 };
let prevCursor = { x: 0.5, y: 0.5 };
let velocity = { x: 0, y: 0 };
let prevNqi: number | null = null;

/**
 * Updates the virtual cursor based on the signal trend and change in NQI.
 * Stabilized to prevent jitter and provide smooth, signal-driven movement.
 */
function updateCursor(nqi: number, trend: SignalTrend): void {
  if (prevNqi === null) {
    prevNqi = nqi;
    return;
  }

  const nqiDiff = Math.abs(nqi - prevNqi);

  // 1. Movement Threshold: Ignore noise (e.g., ±2.5 NQI fluctuations)
  // This ensures the cursor stays still when the device is stationary.
  const STABILITY_THRESHOLD = 2.5;
  
  if (nqiDiff < STABILITY_THRESHOLD) {
    // If signal is steady, rapidly damp velocity to ensure the cursor stays still
    velocity.x *= 0.4;
    velocity.y *= 0.4;
    
    // If velocity is negligible, zero it out completely
    if (Math.abs(velocity.x) < 0.001) velocity.x = 0;
    if (Math.abs(velocity.y) < 0.001) velocity.y = 0;
  } else {
    // Signal change is meaningful, update reference NQI for next threshold check
    prevNqi = nqi;

    // 2. Signal-driven movement force
    // Proportional to change: small change -> minimal move, large change -> noticeable shift
    const sensitivity = 0.05;
    const movementForce = Math.min(nqiDiff * sensitivity, 0.15);

    // 3. Apply smoothing to movement (interpolation)
    // We calculate a target impulse and lerp towards it to avoid sudden jumps.
    // Movement character is slightly modified by the signal trend.
    const angle = Math.random() * Math.PI * 2;
    const targetVelX = Math.cos(angle) * movementForce;
    const targetVelY = Math.sin(angle) * movementForce;

    const lerpFactor = trend === "down" ? 0.2 : 0.35; // Signal drops feel a bit "heavier"
    velocity.x += (targetVelX - velocity.x) * lerpFactor;
    velocity.y += (targetVelY - velocity.y) * lerpFactor;
  }

  // 4. Maximum movement speed limit
  // Prevents the cursor from "flying" across the screen on signal spikes
  const MAX_SPEED = 0.05;
  const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  if (currentSpeed > MAX_SPEED) {
    const scale = MAX_SPEED / currentSpeed;
    velocity.x *= scale;
    velocity.y *= scale;
  }

  // 5. Update cursor position
  cursor.x += velocity.x;
  cursor.y += velocity.y;

  // Clamp cursor between 0 and 1 (screen bounds)
  cursor.x = Math.max(0, Math.min(1, cursor.x));
  cursor.y = Math.max(0, Math.min(1, cursor.y));
}

/**
 * Adds a new signal point to the trail.
 * Uses cursor coordinates to simulate movement with spatial dispersion for a heatmap effect.
 */
export function addPoint(nqi: number, trend: SignalTrend): void {
  const now = Date.now();
  updateCursor(nqi, trend);

  // Update the 2D grid field
  signalField.update(cursor.x, cursor.y, nqi);

  // Add a small positional variation to NQI (subtle ±5 range)
  const variation = (Math.sin(cursor.x * 10) + Math.cos(cursor.y * 10)) * 2;
  const adjustedNqi = Math.max(0, Math.min(100, nqi + variation));


  // Adaptive dispersion: Higher NQI = larger spread, Lower NQI = tighter clustering
  // Normalized spread radius between 0.01 and 0.04
  const spreadRadius = 0.01 + (nqi / 100) * 0.03;

  const applyDispersion = (x: number, y: number) => {
    const ox = (Math.random() - 0.5) * spreadRadius * 2;
    const oy = (Math.random() - 0.5) * spreadRadius * 2;
    return {
      x: Math.max(0, Math.min(1, x + ox)),
      y: Math.max(0, Math.min(1, y + oy))
    };
  };

  // Interpolate between prevCursor and current cursor to fill gaps
  const steps = 3;
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const ix = prevCursor.x + (cursor.x - prevCursor.x) * t;
    const iy = prevCursor.y + (cursor.y - prevCursor.y) * t;

    const dispersed = applyDispersion(ix, iy);

    points.push({
      ...dispersed,
      nqi: adjustedNqi,
      trend: trend,
      timestamp: now,
    });
  }

  // Add the final cursor point with dispersion
  const dispersedFinal = applyDispersion(cursor.x, cursor.y);
  points.push({
    ...dispersedFinal,
    nqi: adjustedNqi,
    trend: trend,
    timestamp: now,
  });

  // Update previous cursor position (Store the PURE cursor position for next interpolation)
  prevCursor = { ...cursor };

  // Keep max points limit intact
  while (points.length > MAX_POINTS) {
    points.shift();
  }
}

/**
 * Returns the current virtual cursor position.
 */
export function getCursor(): { x: number; y: number } {
  return { ...cursor };
}

/**
 * Returns the current list of signal points.
 */
export function getPoints(): SignalPoint[] {
  return [...points];
}

/**
 * Returns the point with the highest NQI within the current trail history.
 * Used to highlight the "best signal" region.
 */
export function getBestPoint(): SignalPoint | null {
  if (points.length === 0) return null;
  
  return points.reduce((best, current) => 
    (current.nqi > best.nqi) ? current : best
  , points[0]);
}

/**
 * Clears all points from the trail.
 */
export function clearPoints(): void {
  points = [];
  velocity = { x: 0, y: 0 };
  cursor = { x: 0.5, y: 0.5 };
  prevCursor = { x: 0.5, y: 0.5 };
}
