export interface NetworkData {
  latency: number;
  jitter: number;
  nqi: number;
  status: "Strong" | "Medium" | "Weak";
}

class MeasurementEngine {
  private samples: number[] = [];
  private readonly maxSamples = 10;

  public async measure(): Promise<NetworkData> {
    const startTime = performance.now();
    try {
      // Use dynamic origin to ensure it works on any host (IP, localhost, etc.) via HTTPS/HTTP
      await fetch(window.location.origin + "/index.html", { 
        cache: "no-store", 
        method: "HEAD",
        mode: "same-origin" // Ensure it targets the same server
      });
    } catch (error) {
      // Silently fail to avoid console spam during connection issues or certificate warnings
    }
    const latency = performance.now() - startTime;



    




    this.samples.push(latency);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }


    
    const jitter = this.calculateJitter();
    const nqi = this.calculateNQI(latency, jitter);
    const status = this.getStatus(nqi);

    return {
      latency: Math.round(latency),
      jitter: Math.round(jitter),
      nqi,
      status,
    };
  }

  private calculateJitter(): number {
    if (this.samples.length < 2) return 0;
    let totalDiff = 0;
    for (let i = 1; i < this.samples.length; i++) {
      totalDiff += Math.abs(this.samples[i] - this.samples[i - 1]);
    }
    return totalDiff / (this.samples.length - 1);
  }

  private calculateNQI(latency: number, jitter: number): number {
    // Latency Score (Lower is better)
    // 0ms = 100, 300ms = 0
    const latencyScore = Math.max(0, 100 - (latency / 3));

    // Jitter Score (Lower is better)
    // 0ms = 100, 50ms = 0
    const jitterScore = Math.max(0, 100 - (jitter * 2));

    // Weighted NQI
    return Math.round((latencyScore * 0.6) + (jitterScore * 0.4));
  }

  private getStatus(nqi: number): "Strong" | "Medium" | "Weak" {
    if (nqi >= 70) return "Strong";
    if (nqi >= 40) return "Medium";
    return "Weak";
  }
}

export const measurementEngine = new MeasurementEngine();
