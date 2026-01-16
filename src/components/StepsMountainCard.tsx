"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface StepsMountainCardProps {
  steps?: number;
  goalSteps?: number;
  title?: string;
  onUpdateSteps?: (steps: number) => void;
  onEditGoal?: () => void;
}

const StepsMountainCard: React.FC<StepsMountainCardProps> = ({
  steps: propSteps,
  goalSteps = 10000,
  title = "Steps",
  onUpdateSteps,
  onEditGoal,
}) => {
  const [internalSteps, setInternalSteps] = useState(0);
  const [clouds, setClouds] = useState([
    { x: 50, y: 30, speed: 0.15, size: 1 },
    { x: 150, y: 50, speed: 0.1, size: 0.8 },
    { x: 250, y: 25, speed: 0.2, size: 1.2 },
    { x: 320, y: 60, speed: 0.12, size: 0.9 },
  ]);
  const [sparkles, setSparkles] = useState<
    { x: number; y: number; opacity: number; scale: number }[]
  >([]);
  const [showSunrise, setShowSunrise] = useState(false);
  const animationRef = useRef<number | null>(null);
  const lastMilestoneRef = useRef<number>(0);

  const isDemo = propSteps === undefined;
  const steps = isDemo ? internalSteps : propSteps;
  const progress = Math.min(Math.max(steps / goalSteps, 0), 1);
  const percent = Math.round(progress * 100);

  // Path points for the climber (winding path up the mountain)
  const pathPoints = [
    { x: 80, y: 280 },
    { x: 120, y: 250 },
    { x: 90, y: 220 },
    { x: 140, y: 190 },
    { x: 110, y: 160 },
    { x: 160, y: 130 },
    { x: 130, y: 100 },
    { x: 180, y: 70 },
    { x: 200, y: 45 },
  ];

  const getClimberPosition = useCallback(
    (prog: number) => {
      const index = prog * (pathPoints.length - 1);
      const lower = Math.floor(index);
      const upper = Math.min(lower + 1, pathPoints.length - 1);
      const t = index - lower;

      return {
        x: pathPoints[lower].x + (pathPoints[upper].x - pathPoints[lower].x) * t,
        y: pathPoints[lower].y + (pathPoints[upper].y - pathPoints[lower].y) * t,
      };
    },
    [pathPoints]
  );

  // Check for milestones
  useEffect(() => {
    const milestones = [25, 50, 75, 100];
    const currentMilestone = milestones.find(
      (m) => percent >= m && lastMilestoneRef.current < m
    );

    if (currentMilestone) {
      lastMilestoneRef.current = currentMilestone;
      const pos = getClimberPosition(progress);

      // Create sparkles
      const newSparkles = Array.from({ length: 8 }, (_, i) => ({
        x: pos.x + (Math.random() - 0.5) * 40,
        y: pos.y + (Math.random() - 0.5) * 40,
        opacity: 1,
        scale: Math.random() * 0.5 + 0.5,
      }));
      setSparkles(newSparkles);

      if (currentMilestone === 100) {
        setShowSunrise(true);
      }

      // Fade out sparkles
      setTimeout(() => setSparkles([]), 1500);
    }

    if (percent < 25) {
      lastMilestoneRef.current = 0;
      setShowSunrise(false);
    }
  }, [percent, progress, getClimberPosition]);

  // Cloud animation
  useEffect(() => {
    const animate = () => {
      setClouds((prev) =>
        prev.map((cloud) => ({
          ...cloud,
          x: cloud.x > 420 ? -60 : cloud.x + cloud.speed,
        }))
      );
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const climberPos = getClimberPosition(progress);

  // Terrain colors based on progress
  const getTerrainGradient = () => {
    if (progress < 0.33) return ["#2d5a27", "#3d7a37", "#4a9a47"]; // Forest
    if (progress < 0.66) return ["#6b7280", "#9ca3af", "#d1d5db"]; // Rock
    return ["#e5e7eb", "#f3f4f6", "#ffffff"]; // Snow
  };

  const terrainColors = getTerrainGradient();

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex justify-between items-center">
          <div>
            <p className="text-slate-400 text-sm font-medium">Today</p>
            <h2 className="text-white text-xl font-bold">{title}</h2>
          </div>
          {onEditGoal && (
            <button 
              onClick={onEditGoal}
              className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
            >
              Edit goal
            </button>
          )}
        </div>

        {/* Mountain Visualization */}
        <div className="relative h-80 overflow-hidden">
          <svg
            viewBox="0 0 400 320"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              {/* Sky gradient */}
              <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop
                  offset="0%"
                  stopColor={showSunrise ? "#fbbf24" : "#1e3a5f"}
                  style={{ transition: "stop-color 1s ease" }}
                />
                <stop
                  offset="50%"
                  stopColor={showSunrise ? "#f97316" : "#2d4a6f"}
                  style={{ transition: "stop-color 1s ease" }}
                />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>

              {/* Mountain gradients */}
              <linearGradient
                id="mountainGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="30%" stopColor="#94a3b8" />
                <stop offset="60%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>

              <linearGradient
                id="foregroundMountain"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor={terrainColors[2]} />
                <stop offset="40%" stopColor={terrainColors[1]} />
                <stop offset="100%" stopColor={terrainColors[0]} />
              </linearGradient>

              {/* Glow filter */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Sparkle filter */}
              <filter id="sparkle" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Sky background */}
            <rect width="400" height="320" fill="url(#skyGradient)" />

            {/* Sunrise glow */}
            {showSunrise && (
              <circle
                cx="200"
                cy="50"
                r="80"
                fill="#fbbf24"
                opacity="0.3"
                filter="url(#glow)"
                style={{
                  animation: "pulse 2s ease-in-out infinite",
                }}
              />
            )}

            {/* Stars (visible when not sunrise) */}
            {!showSunrise &&
              Array.from({ length: 20 }, (_, i) => (
                <circle
                  key={i}
                  cx={30 + ((i * 73) % 340)}
                  cy={10 + ((i * 31) % 100)}
                  r={0.5 + (i % 3) * 0.3}
                  fill="white"
                  opacity={0.3 + (i % 5) * 0.1}
                />
              ))}

            {/* Clouds */}
            {clouds.map((cloud, i) => (
              <g
                key={i}
                transform={`translate(${cloud.x}, ${cloud.y}) scale(${cloud.size})`}
                opacity={0.6}
              >
                <ellipse cx="0" cy="0" rx="25" ry="12" fill="white" opacity="0.8" />
                <ellipse cx="-15" cy="5" rx="18" ry="10" fill="white" opacity="0.7" />
                <ellipse cx="18" cy="3" rx="20" ry="11" fill="white" opacity="0.75" />
              </g>
            ))}

            {/* Background mountains */}
            <path
              d="M-20 320 L80 120 L120 180 L180 80 L240 160 L300 100 L360 150 L420 90 L420 320 Z"
              fill="url(#mountainGradient)"
              opacity="0.5"
            />

            {/* Mid-ground mountain */}
            <path
              d="M-20 320 L60 180 L100 220 L160 140 L220 200 L280 120 L340 180 L400 140 L420 320 Z"
              fill="url(#mountainGradient)"
              opacity="0.7"
            />

            {/* Main mountain (foreground) */}
            <path
              d="M50 320 L200 40 L350 320 Z"
              fill="url(#foregroundMountain)"
            />

            {/* Snow cap detail */}
            <path
              d="M165 100 L200 40 L235 100 L220 95 L200 105 L180 90 Z"
              fill="#ffffff"
              opacity="0.9"
            />

            {/* Rocky texture lines */}
            <path
              d="M140 180 L160 160 M180 200 L200 170 M220 190 L240 160 M260 210 L280 180"
              stroke="#475569"
              strokeWidth="1"
              opacity="0.3"
              fill="none"
            />

            {/* Trees (forest zone) */}
            {progress < 0.5 &&
              Array.from({ length: 8 }, (_, i) => {
                const treeX = 80 + i * 30;
                const treeY = 260 + (i % 3) * 15;
                return (
                  <g key={`tree-${i}`} transform={`translate(${treeX}, ${treeY})`}>
                    <polygon
                      points="0,-20 8,0 -8,0"
                      fill="#1a472a"
                      opacity={1 - progress * 1.5}
                    />
                    <rect
                      x="-2"
                      y="0"
                      width="4"
                      height="8"
                      fill="#5c4033"
                      opacity={1 - progress * 1.5}
                    />
                  </g>
                );
              })}

            {/* Winding path */}
            <path
              d={`M ${pathPoints.map((p) => `${p.x},${p.y}`).join(" L ")}`}
              stroke="#94a3b8"
              strokeWidth="3"
              strokeDasharray="8,4"
              fill="none"
              opacity="0.4"
            />

            {/* Milestone markers */}
            {[0.25, 0.5, 0.75].map((milestone, i) => {
              const pos = getClimberPosition(milestone);
              const reached = progress >= milestone;
              return (
                <g key={`milestone-${i}`}>
                  <circle
                    cx={pos.x + 15}
                    cy={pos.y}
                    r="6"
                    fill={reached ? "#22d3ee" : "#475569"}
                    opacity={reached ? 1 : 0.5}
                  />
                  <text
                    x={pos.x + 15}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fontSize="8"
                    fill={reached ? "#0f172a" : "#94a3b8"}
                    fontWeight="bold"
                  >
                    {milestone * 100}
                  </text>
                </g>
              );
            })}

            {/* Summit flag */}
            <g transform="translate(200, 35)">
              <line x1="0" y1="0" x2="0" y2="-20" stroke="#94a3b8" strokeWidth="2" />
              <polygon
                points="0,-20 15,-15 0,-10"
                fill={progress >= 1 ? "#22d3ee" : "#475569"}
                opacity={progress >= 1 ? 1 : 0.5}
              />
            </g>

            {/* Sparkles */}
            {sparkles.map((sparkle, i) => (
              <g
                key={`sparkle-${i}`}
                transform={`translate(${sparkle.x}, ${sparkle.y}) scale(${sparkle.scale})`}
                opacity={sparkle.opacity}
                filter="url(#sparkle)"
              >
                <polygon
                  points="0,-8 2,-2 8,0 2,2 0,8 -2,2 -8,0 -2,-2"
                  fill="#fbbf24"
                />
              </g>
            ))}

            {/* Climber */}
            <g
              transform={`translate(${climberPos.x}, ${climberPos.y})`}
              filter="url(#glow)"
            >
              {/* Climber body */}
              <circle cx="0" cy="-8" r="6" fill="#22d3ee" />
              <ellipse cx="0" cy="2" rx="5" ry="8" fill="#0891b2" />
              {/* Hiking stick */}
              <line
                x1="6"
                y1="-5"
                x2="12"
                y2="8"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Pulse ring */}
              <circle
                cx="0"
                cy="0"
                r="12"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                opacity="0.5"
                style={{
                  animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
                }}
              />
            </g>
          </svg>

          {/* CSS animations */}
          <style>{`
            @keyframes ping {
              75%, 100% {
                transform: scale(2);
                opacity: 0;
              }
            }
            @keyframes pulse {
              0%, 100% {
                opacity: 0.3;
              }
              50% {
                opacity: 0.5;
              }
            }
          `}</style>
        </div>

        {/* Stats section */}
        <div className="px-6 py-4 bg-slate-800/50">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="text-4xl font-bold text-white">
                {steps.toLocaleString()}
              </span>
              <span className="text-slate-400 ml-2">
                / {goalSteps.toLocaleString()}
              </span>
            </div>
            <div
              className={`text-2xl font-bold ${
                progress >= 1
                  ? "text-yellow-400"
                  : progress >= 0.75
                  ? "text-cyan-400"
                  : progress >= 0.5
                  ? "text-emerald-400"
                  : "text-slate-400"
              }`}
            >
              {percent}%
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${percent}%`,
                background:
                  progress >= 1
                    ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                    : progress >= 0.75
                    ? "linear-gradient(90deg, #22d3ee, #06b6d4)"
                    : progress >= 0.5
                    ? "linear-gradient(90deg, #34d399, #10b981)"
                    : "linear-gradient(90deg, #94a3b8, #64748b)",
              }}
            />
          </div>

          {/* Milestone indicators */}
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span className={progress >= 0.25 ? "text-cyan-400" : ""}>25%</span>
            <span className={progress >= 0.5 ? "text-emerald-400" : ""}>50%</span>
            <span className={progress >= 0.75 ? "text-cyan-400" : ""}>75%</span>
            <span className={progress >= 1 ? "text-yellow-400" : ""}>Summit</span>
          </div>
        </div>

        {/* Edit steps slider */}
        {onUpdateSteps && (
          <div className="px-6 py-4 border-t border-slate-700">
            <label className="block text-sm text-slate-400 mb-2">
              Update Steps: {steps.toLocaleString()} steps
            </label>
            <input
              type="range"
              min="0"
              max={goalSteps * 1.5}
              value={steps}
              onChange={(e) => {
                const newSteps = Number(e.target.value);
                onUpdateSteps(newSteps);
              }}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between mt-1 text-xs text-slate-500">
              <span>0</span>
              <span>{Math.round(goalSteps * 1.5).toLocaleString()}</span>
            </div>
          </div>
        )}
        
        {/* Demo slider */}
        {isDemo && !onUpdateSteps && (
          <div className="px-6 py-4 border-t border-slate-700">
            <label className="block text-sm text-slate-400 mb-2">
              Test Slider: {internalSteps.toLocaleString()} steps
            </label>
            <input
              type="range"
              min="0"
              max={goalSteps}
              value={internalSteps}
              onChange={(e) => setInternalSteps(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StepsMountainCard;
