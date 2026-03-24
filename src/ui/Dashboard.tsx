import { useEffect, useState, useRef } from "react";
import { measurementEngine } from "../engine/MeasurementEngine";
import type { NetworkData } from "../engine/MeasurementEngine";
import { KalmanFilter } from "../filters/KalmanFilter";
import { TrendAnalyzer } from "../engine/TrendAnalyzer";
import type { TrendResult } from "../engine/TrendAnalyzer";
import { moveInDirection, mapCurrentPosition } from "../engine/signalTrail";
import { signalField } from "../engine/SignalField";
import BackgroundCanvas from "../visualization/BackgroundCanvas";

export default function Dashboard() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [trendResult, setTrendResult] = useState<TrendResult | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [bestSignal, setBestSignal] = useState<{ nqi: number } | null>(null);
  
  const nqiFilter = useRef(new KalmanFilter(0.02, 0.2));
  const trendAnalyzer = useRef(new TrendAnalyzer());
  const lastNqi = useRef<number>(0);
  
  // Step detection and Heading refs
  const initialHeading = useRef<number | null>(null);
  const smoothedHeading = useRef(0);
  const lastStableHeading = useRef(0);
  const HEADING_THRESHOLD = (15 * Math.PI) / 180; // 15 degrees in radians
  const lastStepTime = useRef(0);
  const stepThreshold = 12.2; 
  const stepCooldown = 600; // Increased to prevent noise-triggered steps

  const requestPermission = async () => {
    // 1. Correct Sensor Detection
    const hasMotion = 'DeviceMotionEvent' in window;
    const hasOrientation = 'DeviceOrientationEvent' in window;

    if (!hasMotion && !hasOrientation) {
      setPermissionState('unavailable');
      return;
    }

    try {
      // 2. Correct Permission Flow for iOS
      const DeviceMotion = window.DeviceMotionEvent as any;
      const DeviceOrientation = window.DeviceOrientationEvent as any;

      if (typeof DeviceMotion.requestPermission === 'function') {
        // iOS Style
        const motionRes = await DeviceMotion.requestPermission();
        const orientationRes = typeof DeviceOrientation.requestPermission === 'function' 
          ? await DeviceOrientation.requestPermission() 
          : 'granted';
        
        if (motionRes === 'granted' && orientationRes === 'granted') {
          setPermissionState('granted');
        } else {
          setPermissionState('denied');
        }
      } else {
        // 3. Android / Chrome / Others (No explicit permission required)
        setPermissionState('granted');
      }
    } catch (e) {
      console.error("Sensor permission request failed:", e);
      setPermissionState('denied');
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null) {
        const currentAlpha = (e.alpha * Math.PI) / 180;
        
        if (initialHeading.current === null) {
          initialHeading.current = currentAlpha;
        }

        const relativeAlpha = currentAlpha - initialHeading.current;
        
        // Stronger exponential smoothing: 0.9 * prev + 0.1 * current
        smoothedHeading.current = (0.9 * smoothedHeading.current) + (0.1 * relativeAlpha);

        // Direction Stabilization: Only update stable heading if change > 15 degrees
        const diff = Math.abs(smoothedHeading.current - lastStableHeading.current);
        if (diff > HEADING_THRESHOLD) {
          lastStableHeading.current = smoothedHeading.current;
        }
      }
    };

    const handleMotion = (e: DeviceMotionEvent) => {
      // Use accelerationIncludingGravity for broader Android support
      const accel = e.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

      const mag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
      
      const now = Date.now();
      // Threshold 12.2 accounts for gravity (9.8) + movement spike
      if (mag > stepThreshold && (now - lastStepTime.current) > stepCooldown) {
        console.log("Step detected");
        console.log("Stable heading:", (lastStableHeading.current * 180 / Math.PI).toFixed(1), "°");
        
        // Move in stabilized direction
        moveInDirection(lastStableHeading.current - Math.PI / 2);
        
        if (lastNqi.current > 0) {
          mapCurrentPosition(lastNqi.current);
          const best = signalField.getBestSignal();
          if (best) setBestSignal({ nqi: Math.round(best.nqi) });
        }
        
        lastStepTime.current = now;
      }
    };

    // 3. Attach Sensors AFTER permission
    if (permissionState === 'granted') {
      window.addEventListener("deviceorientation", handleOrientation, true);
      window.addEventListener("devicemotion", handleMotion, true);
    }

    const measure = async () => {
      if (!navigator.onLine) return;

      const result = await measurementEngine.measure();
      const filteredNqi = Math.round(nqiFilter.current.filter(result.nqi));
      lastNqi.current = filteredNqi;
      
      setTrendResult(trendAnalyzer.current.analyze(filteredNqi));
      mapCurrentPosition(filteredNqi);

      const best = signalField.getBestSignal();
      if (best) setBestSignal({ nqi: Math.round(best.nqi) });
      
      setData({ ...result, nqi: filteredNqi });
    };

    measure();
    const interval = setInterval(measure, 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("deviceorientation", handleOrientation, true);
      window.removeEventListener("devicemotion", handleMotion, true);
      clearInterval(interval);
    };
  }, [permissionState]);

  // Permission / Initialization UI
  if (permissionState !== 'granted' || !data) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white p-8 text-center">
        <h1 className="text-5xl font-bold mb-4 tracking-tight">Signal Zone</h1>
        <p className="text-white/50 mb-12 text-lg max-w-sm">
          Spatial Signal Explorer requires motion sensors to map your room.
        </p>

        {permissionState === 'prompt' && (
          <button 
            onClick={requestPermission}
            className="w-full max-w-xs px-10 py-5 bg-white text-black font-black rounded-2xl text-xl shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-95 transition-all"
          >
            Enable Sensors
          </button>
        )}

        {permissionState === 'denied' && (
          <div className="text-red-400 font-bold bg-red-500/10 p-6 rounded-2xl border border-red-500/20">
            Motion sensor permission was denied. Please refresh and allow sensor access.
          </div>
        )}

        {permissionState === 'unavailable' && (
          <div className="text-yellow-400 font-bold bg-yellow-500/10 p-6 rounded-2xl border border-yellow-500/20">
            Motion sensors are not available on this device.
          </div>
        )}

        {permissionState === 'granted' && !data && (
          <div className="text-2xl animate-pulse font-medium text-white/80">
            Initializing Sensors...
          </div>
        )}

        <div className="mt-16 grid grid-cols-1 gap-6 text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
          <div className="flex items-center justify-center gap-3">
            <span className="w-8 h-[1px] bg-white/10" />
            Hold phone flat
            <span className="w-8 h-[1px] bg-white/10" />
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="w-8 h-[1px] bg-white/10" />
            Walk slowly
            <span className="w-8 h-[1px] bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  const { nqi, status, latency, jitter } = data;

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center text-white p-4">
      <BackgroundCanvas 
        nqi={nqi} 
        trend={trendResult?.trend} 
        heading={smoothedHeading.current} 
      />

      {isOffline && (
        <div className="fixed top-4 bg-red-500/80 backdrop-blur-md px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest animate-bounce z-50">
          Offline
        </div>
      )}

      <div className="fixed top-8 left-0 right-0 text-center opacity-30 pointer-events-none">
        <h1 className="text-xl font-bold tracking-[0.3em] uppercase">Signal Zone</h1>
      </div>

      {bestSignal && (
        <div className="fixed top-20 bg-green-500/10 border border-green-500/20 px-4 py-1 rounded-full flex items-center gap-2 backdrop-blur-md">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-green-300/80">
            Best Signal Location Detected: {bestSignal.nqi} NQI
          </span>
        </div>
      )}

      <div className="text-9xl font-bold tabular-nums mb-2 drop-shadow-2xl">{nqi}</div>
      <div className="text-2xl font-medium mb-4 text-white/80">{status}</div>
      
      <div className={`mb-12 px-6 py-2 rounded-full text-sm font-bold border transition-all duration-500 shadow-lg ${
        trendResult?.trend === 'up' ? 'bg-green-500/20 border-green-500/40 text-green-300' :
        trendResult?.trend === 'down' ? 'bg-red-500/20 border-red-500/40 text-red-300' :
        'bg-white/10 border-white/20 text-white/60'
      }`}>
        {trendResult?.suggestion || "Calibrating..."}
      </div>

      <div className="grid grid-cols-2 gap-10 text-center bg-white/5 p-8 rounded-[2rem] backdrop-blur-xl border border-white/10 shadow-2xl">
        <div>
          <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] mb-2 font-black">Latency</div>
          <div className="text-3xl font-mono font-bold">{latency}ms</div>
        </div>
        <div>
          <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] mb-2 font-black">Jitter</div>
          <div className="text-3xl font-mono font-bold">{jitter}ms</div>
        </div>
      </div>
      
      <div className="mt-12 text-[10px] uppercase tracking-[0.4em] text-white/20 font-bold">
        Walk to update map
      </div>
    </div>
  );
}
