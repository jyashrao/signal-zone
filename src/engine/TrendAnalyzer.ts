export type SignalTrend = "up" | "down" | "stable";

export interface TrendResult {
  trend: SignalTrend;
  suggestion: string;
}

export class TrendAnalyzer {
  private history: number[] = [];
  private readonly windowSize = 8;
  private readonly threshold = 2; // NQI points change to trigger trend

  public analyze(currentNqi: number): TrendResult {
    this.history.push(currentNqi);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    if (this.history.length < 4) {
      return { trend: "stable", suggestion: "Calculating trend..." };
    }

    // Split history into two halves to compare averages
    const mid = Math.floor(this.history.length / 2);
    const firstHalf = this.history.slice(0, mid);
    const secondHalf = this.history.slice(mid);

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;

    if (diff > this.threshold) {
      return {
        trend: "up",
        suggestion: "Signal improving, keep moving"
      };
    } else if (diff < -this.threshold) {
      return {
        trend: "down",
        suggestion: "Signal dropping, move back"
      };
    } else {
      return {
        trend: "stable",
        suggestion: "Stable signal, optimal position"
      };
    }
  }
}
