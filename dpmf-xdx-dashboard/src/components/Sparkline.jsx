import { useEffect, useRef, useState } from "react";

export default function Sparkline({ data }) {
  if (!data || data.length === 0) return null;

  const [animatedData, setAnimatedData] = useState(data);
  const prevData = useRef(data);

  // Smooth transition animation
  useEffect(() => {
    const frames = 20; // animation smoothness
    let frame = 0;

    const start = prevData.current;
    const end = data;

    const animate = () => {
      frame++;
      const progress = frame / frames;

      const interpolated = start.map((v, i) => {
        const target = end[i] ?? end[end.length - 1];
        return v + (target - v) * progress;
      });

      setAnimatedData(interpolated);

      if (frame < frames) {
        requestAnimationFrame(animate);
      } else {
        prevData.current = data;
      }
    };

    animate();
  }, [data]);

  // Handle flat data (avoid divide-by-zero)
  const max = Math.max(...animatedData);
  const min = Math.min(...animatedData);
  const range = max - min || 1;

  // Determine trend colour
  const isUp = animatedData[animatedData.length - 1] >= animatedData[0];
  const strokeColor = isUp ? "#00ff6a" : "#ff3b3b";

  // Build polyline points
  const points = animatedData
    .map((v, i) => {
      const x = (i / (animatedData.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="sparkline">
      {/* Gradient fill */}
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      <polygon
        points={`0,100 ${points} 100,100`}
        fill="url(#sparkFill)"
      />

      {/* Line */}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
