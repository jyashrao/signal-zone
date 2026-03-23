export interface GridCell {
  nqi: number;
  intensity: number; // 0 to 1, representing how "fresh" or "strong" the data is
  lastUpdate: number;
}

export class SignalField {
  private grid: GridCell[][];
  private readonly rows: number;
  private readonly cols: number;
  private readonly decayRate = 0.00004; // Slightly slower decay for better heatmap trails
  private readonly diffusionRadius = 2; // Increased for smoother spatial blending

  constructor(rows = 24, cols = 24) {
    this.rows = rows;
    this.cols = cols;
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        nqi: 0,
        intensity: 0,
        lastUpdate: Date.now(),
      }))
    );
  }

  /**
   * Updates the grid based on a new measurement at a normalized (x, y) position.
   */
  public update(x: number, y: number, nqi: number): void {
    const col = Math.floor(x * (this.cols - 1));
    const row = Math.floor(y * (this.rows - 1));
    const now = Date.now();

    // Update the target cell and its immediate neighbors for a smoother field
    for (let dr = -this.diffusionRadius; dr <= this.diffusionRadius; dr++) {
      for (let dc = -this.diffusionRadius; dc <= this.diffusionRadius; dc++) {
        const r = row + dr;
        const c = col + dc;

        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          const distance = Math.sqrt(dr * dr + dc * dc);
          const weight = Math.max(0, 1 - distance / (this.diffusionRadius + 1));
          
          const cell = this.grid[r][c];
          
          // Weighted average for NQI to smooth transitions
          // If the cell is fresh (high intensity), we blend. If it's old, we overwrite more.
          const blendFactor = 0.3 * weight;
          cell.nqi = cell.nqi * (1 - blendFactor) + nqi * blendFactor;
          
          // Boost intensity (max 1.0)
          cell.intensity = Math.min(1.0, cell.intensity + 0.4 * weight);
          cell.lastUpdate = now;
        }
      }
    }
  }

  /**
   * Applies decay to all cells in the grid based on time elapsed.
   */
  public step(): void {
    const now = Date.now();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        const elapsed = now - cell.lastUpdate;
        
        if (elapsed > 0) {
          // Linear decay of intensity
          cell.intensity = Math.max(0, cell.intensity - this.decayRate * elapsed);
          cell.lastUpdate = now;
          
          // If intensity is zero, slowly reset NQI to 0 to clear the field
          if (cell.intensity === 0) {
            cell.nqi *= 0.95;
          }
        }
      }
    }
  }

  public getGrid(): GridCell[][] {
    return this.grid;
  }

  public getDimensions() {
    return { rows: this.rows, cols: this.cols };
  }
}

export const signalField = new SignalField();
