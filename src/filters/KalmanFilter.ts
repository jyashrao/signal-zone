/**
 * A simple 1D Kalman Filter for smoothing noisy network metrics.
 * 
 * Formula:
 * 1. Predict: 
 *    x = x (state remains same for 1D constant)
 *    P = P + Q (process noise)
 * 2. Update:
 *    K = P / (P + R) (Kalman Gain)
 *    x = x + K * (measurement - x)
 *    P = (1 - K) * P
 */
export class KalmanFilter {
  private x: number | null = null; // Filtered value (state)
  private p = 1.0;                 // Estimation error covariance
  private readonly q: number;      // Process noise
  private readonly r: number;      // Measurement noise

  /**
   * @param q Process noise (how much we trust the prediction) - lower = smoother
   * @param r Measurement noise (how much we trust the sensor) - higher = smoother
   */
  constructor(q = 0.01, r = 0.1) {
    this.q = q;
    this.r = r;
  }

  public filter(measurement: number): number {
    // Initialization
    if (this.x === null) {
      this.x = measurement;
      return measurement;
    }

    // Prediction update
    this.p = this.p + this.q;

    // Measurement update
    const k = this.p / (this.p + this.r);
    this.x = this.x + k * (measurement - this.x);
    this.p = (1 - k) * this.p;

    return this.x;
  }
}
