export interface GridCell {
  avgNqi: number;
  samples: number;
  visited: boolean;
}

export class SignalField {
  private grid: GridCell[][];
  private readonly rows: number;
  private readonly cols: number;
  private bestCell: { r: number, c: number, nqi: number } | null = null;

  constructor(rows = 40, cols = 40) {
    this.rows = rows;
    this.cols = cols;
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        avgNqi: 0,
        samples: 0,
        visited: false,
      }))
    );
  }

  /**
   * Updates the grid based on a new measurement at a normalized (x, y) position.
   * Uses a weighted running average to apply spatial smoothing to nearby cells.
   */
  public update(x: number, y: number, nqi: number): void {
    const col = Math.floor(x * (this.cols - 1));
    const row = Math.floor(y * (this.rows - 1));

    const smoothingRadius = 3.5; // Influence radius in grid cells

    for (let dr = -Math.ceil(smoothingRadius); dr <= Math.ceil(smoothingRadius); dr++) {
      for (let dc = -Math.ceil(smoothingRadius); dc <= Math.ceil(smoothingRadius); dc++) {
        const r = row + dr;
        const c = col + dc;

        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          const distance = Math.sqrt(dr * dr + dc * dc);
          if (distance > smoothingRadius) continue;

          // Influence weight follows a quadratic decay for smoother gradients
          const weight = Math.pow(1 - distance / smoothingRadius, 2);
          
          const cell = this.grid[r][c];
          
          // Apply weighted running average
          // We treat the "influence" as a fractional sample
          const totalWeight = cell.samples + weight;
          if (totalWeight > 0) {
            cell.avgNqi = (cell.avgNqi * cell.samples + nqi * weight) / totalWeight;
            cell.samples = totalWeight;
            cell.visited = true;
          }

          // Track best signal globally
          if (!this.bestCell || cell.avgNqi > this.bestCell.nqi) {
            this.bestCell = { r: r, c: c, nqi: cell.avgNqi };
          }
        }
      }
    }
  }

  public getBestSignal() {
    return this.bestCell;
  }

  /**
   * Persistent map - no decay needed
   */
  public step(): void {
  }

  public getGrid(): GridCell[][] {
    return this.grid;
  }

  public getDimensions() {
    return { rows: this.rows, cols: this.cols };
  }
}

export const signalField = new SignalField();
