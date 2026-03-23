import { useEffect, useState, useRef } from "react";
import { measurementEngine } from "../engine/MeasurementEngine";
import type { NetworkData } from "../engine/MeasurementEngine";
import { KalmanFilter } from "../filters/KalmanFilter";
import { TrendAnalyzer } from "../engine/TrendAnalyzer";
import type { TrendResult } from "../engine/TrendAnalyzer";
import { addPoint } from "../engine/signalTrail";
import BackgroundCanvas from "../visualization/BackgroundCanvas";

export default function Dashboard() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [trendResult, setTrendResult] = useState<TrendResult | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const nqiFilter = useRef(new KalmanFilter(0.02, 0.2));
  const trendAnalyzer = useRef(new TrendAnalyzer());

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const measure = async () => {
      if (!navigator.onLine) return;

      const result = await measurementEngine.measure();
      
      // Apply Kalman filter to NQI
      const filteredNqi = Math.round(nqiFilter.current.filter(result.nqi));
      
      // Analyze trend
      const trend = trendAnalyzer.current.analyze(filteredNqi);
      setTrendResult(trend);
      
      // Store point in historical trail
      addPoint(filteredNqi, trend.trend);
      
      setData({
        ...result,
        nqi: filteredNqi
      });
    };

    measure(); // Initial measurement
    const interval = setInterval(measure, 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!data) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white">
        <h1 className="text-4xl font-bold mb-6">Signal Zone</h1>
        <div className="text-2xl animate-pulse">Initializing...</div>
      </div>
    );
  }

  const { nqi, status, latency, jitter } = data;

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center text-white p-4">
      <BackgroundCanvas nqi={nqi} trend={trendResult?.trend} />

      {isOffline && (
        <div className="fixed top-4 bg-red-500/80 backdrop-blur-md px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest animate-bounce">
          Offline - Showing last known state
        </div>
      )}

      <h1 className="text-4xl font-bold mb-6">Signal Zone</h1>

      <div className="text-8xl font-bold tabular-nums mb-2">{nqi}</div>
      <div className="text-2xl font-medium mb-2 text-white/80">{status}</div>
      
      <div className={`mb-8 px-4 py-1 rounded-full text-sm font-medium border transition-colors duration-500 ${
        trendResult?.trend === 'up' ? 'bg-green-500/20 border-green-500/40 text-green-300' :
        trendResult?.trend === 'down' ? 'bg-red-500/20 border-red-500/40 text-red-300' :
        'bg-white/10 border-white/20 text-white/60'
      }`}>
        {trendResult?.suggestion || "Analyzing signal..."}
      </div>

      <div className="grid grid-cols-2 gap-8 text-center bg-white/5 p-6 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-500">
        <div>
          <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] mb-2 font-bold">Latency</div>
          <div className="text-2xl font-mono">{latency}ms</div>
        </div>
        <div>
          <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] mb-2 font-bold">Jitter</div>
          <div className="text-2xl font-mono">{jitter}ms</div>
        </div>
      </div>
    </div>
  );
}