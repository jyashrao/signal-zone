import { signalField } from "./SignalField";

let cursor = { x: 0.5, y: 0.5 };
const STEP_SIZE = 0.012; // ~0.48 of a grid cell (40x40 grid)

/**
 * Moves the cursor one "step" in the given direction (radians).
 */
export function moveInDirection(angleRad: number): void {
  cursor.x += Math.cos(angleRad) * STEP_SIZE;
  cursor.y += Math.sin(angleRad) * STEP_SIZE;

  // Clamp to bounds
  cursor.x = Math.max(0, Math.min(1, cursor.x));
  cursor.y = Math.max(0, Math.min(1, cursor.y));

  console.log(`Pointer position: x=${cursor.x.toFixed(3)}, y=${cursor.y.toFixed(3)}`);
}

/**
 * Updates the signal value for the cell currently under the cursor.
 */
export function mapCurrentPosition(nqi: number): void {
  signalField.update(cursor.x, cursor.y, nqi);
}

/**
 * Returns the current virtual cursor position.
 */
export function getCursor(): { x: number; y: number } {
  return { ...cursor };
}

/**
 * Resets the explorer to the center.
 */
export function resetExplorer(): void {
  cursor = { x: 0.5, y: 0.5 };
}
