"use client";

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface WaterBottleProps {
  userId: Id<"users">;
  date: string;
  targetAmount?: number; // in liters, defaults to 2L
  compact?: boolean; // If true, shows just the bottle without controls
  onExpand?: () => void; // Callback when clicking in compact mode
}

export default function WaterBottle({ 
  userId, 
  date, 
  targetAmount = 2.0,
  compact = false,
  onExpand 
}: WaterBottleProps) {
  const [waveOffset, setWaveOffset] = useState(0);
  const [unit, setUnit] = useState<'ml' | 'L'>('L'); // Use L instead of oz for simplicity

  // Get current water intake from database
  const dailyTracking = useQuery(
    api.dailyTracking.getDailyTracking,
    { userId, date }
  );

  // Mutations
  const addWater = useMutation(api.dailyTracking.addWaterIntake);
  const updateWater = useMutation(api.dailyTracking.updateDailyTracking);

  const currentAmount = dailyTracking?.waterIntake || 0; // in liters
  const targetLiters = targetAmount;

  // Conversion constants
  const convertToDisplay = (liters: number) => {
    if (unit === 'ml') {
      return Math.round(liters * 1000);
    }
    return Math.round(liters * 10) / 10;
  };

  const getIncrement = (baseIncrement: number) => {
    // baseIncrement is in liters
    if (unit === 'ml') {
      return baseIncrement * 1000;
    }
    return baseIncrement;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setWaveOffset(prev => (prev + 3) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  const percentage = Math.min((currentAmount / targetLiters) * 100, 100);
  const isFull = currentAmount >= targetLiters;

  const handleIncrement = async (amount: number) => {
    // amount is in liters
    const newAmount = Math.max(0, Math.min(currentAmount + amount, 5)); // Max 5L
    await updateWater({
      userId,
      date,
      waterIntake: newAmount,
    });
  };

  const handleTargetChange = (amount: number) => {
    // This could be saved to user preferences, but for now we'll just use the prop
    // Could add a mutation to save user preferences if needed
  };

  // Wave calculation helper
  const waveY = (baseY: number, offset: number, amplitude: number) => {
    return baseY + Math.sin((waveOffset + offset) * Math.PI / 180) * amplitude;
  };

  const waterTop = 390 - (percentage * 3.2);

  const bottleSize = compact ? 120 : 200;
  const bottleHeight = compact ? 252 : 420;

  return (
    <div className={compact ? "cursor-pointer" : ""} onClick={compact ? onExpand : undefined}>
      <div className="relative">
        <svg width={bottleSize} height={bottleHeight} viewBox="0 0 200 420" className={compact ? "scale-75 origin-top" : ""}>
          <defs>
            <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isFull ? "#22d3ee" : "#38bdf8"} />
              <stop offset="100%" stopColor={isFull ? "#0891b2" : "#0284c7"} />
            </linearGradient>
            <linearGradient id="waterSurface" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isFull ? "#67e8f9" : "#7dd3fc"} />
              <stop offset="100%" stopColor={isFull ? "#22d3ee" : "#38bdf8"} />
            </linearGradient>
            <linearGradient id="bottleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
            </linearGradient>
            <linearGradient id="capGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#78716c" />
              <stop offset="30%" stopColor="#57534e" />
              <stop offset="70%" stopColor="#44403c" />
              <stop offset="100%" stopColor="#292524" />
            </linearGradient>
            <linearGradient id="capTopGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a8a29e" />
              <stop offset="50%" stopColor="#78716c" />
              <stop offset="100%" stopColor="#57534e" />
            </linearGradient>
            <linearGradient id="neckGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(148,163,184,0.3)" />
              <stop offset="50%" stopColor="rgba(203,213,225,0.2)" />
              <stop offset="100%" stopColor="rgba(148,163,184,0.3)" />
            </linearGradient>
            <clipPath id="bottleClip">
              <path d="M75 70 L75 55 Q75 50 80 50 L120 50 Q125 50 125 55 L125 70 L140 70 Q145 75 148 85 L152 100 L152 385 Q152 400 135 400 L65 400 Q48 400 48 385 L48 100 L52 85 Q55 75 60 70 Z" />
            </clipPath>
          </defs>

          {/* Bottle body outline */}
          <path 
            d="M75 70 L75 55 Q75 50 80 50 L120 50 Q125 50 125 55 L125 70 L140 70 Q145 75 148 85 L152 100 L152 385 Q152 400 135 400 L65 400 Q48 400 48 385 L48 100 L52 85 Q55 75 60 70 Z" 
            fill="none" 
            stroke="#94a3b8" 
            strokeWidth="2.5"
            opacity="0.6"
          />

          {/* Water with wave animation */}
          <g clipPath="url(#bottleClip)">
            {/* Water body */}
            <rect 
              x="45" 
              y={waterTop} 
              width="110" 
              height={400 - waterTop + 10}
              fill="url(#waterGradient)"
            />
            
            {/* Primary wave */}
            <path
              d={`
                M 40 ${waterTop}
                C ${55} ${waveY(waterTop, 0, 8)}, 
                  ${70} ${waveY(waterTop, 60, 10)}, 
                  ${85} ${waveY(waterTop, 120, 8)}
                C ${100} ${waveY(waterTop, 180, 10)}, 
                  ${115} ${waveY(waterTop, 240, 8)}, 
                  ${130} ${waveY(waterTop, 300, 10)}
                C ${145} ${waveY(waterTop, 0, 8)}, 
                  ${155} ${waveY(waterTop, 60, 6)}, 
                  ${160} ${waterTop}
                L 160 ${waterTop + 30}
                L 40 ${waterTop + 30}
                Z
              `}
              fill="url(#waterSurface)"
            />

            {/* Secondary wave layer */}
            <path
              d={`
                M 40 ${waterTop + 3}
                C ${60} ${waveY(waterTop + 3, 45, 7)}, 
                  ${75} ${waveY(waterTop + 3, 105, 9)}, 
                  ${90} ${waveY(waterTop + 3, 165, 7)}
                C ${105} ${waveY(waterTop + 3, 225, 9)}, 
                  ${120} ${waveY(waterTop + 3, 285, 7)}, 
                  ${135} ${waveY(waterTop + 3, 345, 9)}
                C ${150} ${waveY(waterTop + 3, 45, 7)}, 
                  ${158} ${waveY(waterTop + 3, 90, 5)}, 
                  ${160} ${waterTop + 3}
                L 160 ${waterTop + 35}
                L 40 ${waterTop + 35}
                Z
              `}
              fill={isFull ? "#06b6d4" : "#0ea5e9"}
              opacity="0.5"
            />

            {/* Third wave layer */}
            <path
              d={`
                M 40 ${waterTop + 6}
                C ${65} ${waveY(waterTop + 6, 90, 6)}, 
                  ${80} ${waveY(waterTop + 6, 150, 8)}, 
                  ${95} ${waveY(waterTop + 6, 210, 6)}
                C ${110} ${waveY(waterTop + 6, 270, 8)}, 
                  ${125} ${waveY(waterTop + 6, 330, 6)}, 
                  ${140} ${waveY(waterTop + 6, 30, 8)}
                C ${152} ${waveY(waterTop + 6, 90, 5)}, 
                  ${158} ${waveY(waterTop + 6, 120, 4)}, 
                  ${160} ${waterTop + 6}
                L 160 ${waterTop + 40}
                L 40 ${waterTop + 40}
                Z
              `}
              fill={isFull ? "#0891b2" : "#0284c7"}
              opacity="0.3"
            />

            {/* Bubbles */}
            {percentage > 10 && (
              <>
                <circle 
                  cx={70 + Math.sin(waveOffset * 0.05) * 10} 
                  cy={360 - Math.abs(Math.sin(waveOffset * 0.02) * (percentage * 2))} 
                  r="3" 
                  fill="rgba(255,255,255,0.6)"
                />
                <circle 
                  cx={130 + Math.cos(waveOffset * 0.03) * 8} 
                  cy={330 - Math.abs(Math.cos(waveOffset * 0.025) * (percentage * 1.5))} 
                  r="2" 
                  fill="rgba(255,255,255,0.5)"
                />
                <circle 
                  cx={100 + Math.sin(waveOffset * 0.04) * 15} 
                  cy={380 - Math.abs(Math.sin(waveOffset * 0.015) * (percentage * 2.5))} 
                  r="4" 
                  fill="rgba(255,255,255,0.4)"
                />
                <circle 
                  cx={85 + Math.cos(waveOffset * 0.035) * 12} 
                  cy={345 - Math.abs(Math.cos(waveOffset * 0.018) * (percentage * 1.8))} 
                  r="2.5" 
                  fill="rgba(255,255,255,0.5)"
                />
              </>
            )}
          </g>

          {/* Glass reflection */}
          <path 
            d="M75 70 L75 55 Q75 50 80 50 L120 50 Q125 50 125 55 L125 70 L140 70 Q145 75 148 85 L152 100 L152 385 Q152 400 135 400 L65 400 Q48 400 48 385 L48 100 L52 85 Q55 75 60 70 Z" 
            fill="url(#bottleGradient)" 
            opacity="0.3"
          />

          {/* Bottle neck threading */}
          <rect x="75" y="50" width="50" height="20" fill="url(#neckGradient)" rx="2" />
          <line x1="77" y1="54" x2="123" y2="54" stroke="rgba(148,163,184,0.4)" strokeWidth="1" />
          <line x1="77" y1="58" x2="123" y2="58" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
          <line x1="77" y1="62" x2="123" y2="62" stroke="rgba(148,163,184,0.4)" strokeWidth="1" />
          <line x1="77" y1="66" x2="123" y2="66" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />

          {/* Bottle cap */}
          <ellipse cx="100" cy="48" rx="32" ry="4" fill="#44403c" />
          <rect x="68" y="15" width="64" height="33" rx="4" fill="url(#capGradient)" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <line 
              key={i}
              x1={73 + i * 5} 
              y1="18" 
              x2={73 + i * 5} 
              y2="45" 
              stroke="rgba(0,0,0,0.2)" 
              strokeWidth="2"
            />
          ))}
          <ellipse cx="100" cy="15" rx="32" ry="5" fill="url(#capTopGradient)" />
          <ellipse cx="100" cy="15" rx="25" ry="3" fill="#78716c" />
          <ellipse cx="100" cy="14" rx="18" ry="2" fill="#a8a29e" opacity="0.5" />
          <rect x="70" y="20" width="8" height="20" rx="2" fill="rgba(255,255,255,0.15)" />

          {/* Shine effect */}
          <ellipse cx="62" cy="220" rx="4" ry="100" fill="white" opacity="0.2" />
          <ellipse cx="138" cy="250" rx="3" ry="60" fill="white" opacity="0.1" />
        </svg>

        {/* Percentage label - only show in expanded mode */}
        {!compact && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-16 text-center">
            <div className={`text-4xl font-bold ${isFull ? 'text-cyan-500' : 'text-blue-500'}`}>
              {Math.round(percentage)}%
            </div>
            <div className="text-slate-500 text-sm mt-1">
              {convertToDisplay(currentAmount)}{unit} / {convertToDisplay(targetLiters)}{unit}
            </div>
            {isFull && (
              <div className="text-cyan-500 font-semibold mt-2 animate-pulse">
                ✓ Goal Reached!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls - only show in expanded mode */}
      {!compact && (
        <div className="bg-[#1B212B]/80 backdrop-blur rounded-2xl p-6 shadow-xl min-w-64 mt-6">
          <h2 className="text-xl font-bold text-[#E6EAF0] mb-4">Water Tracker</h2>
          
          {/* Unit Toggle */}
          <div className="mb-6">
            <label className="text-sm font-medium text-[#9AA3B2] mb-2 block">
              Unit
            </label>
            <div className="flex rounded-lg overflow-hidden border border-[#6B7280]">
              <button 
                onClick={() => setUnit('L')}
                className={`flex-1 py-2 px-4 font-medium transition-all ${
                  unit === 'L' 
                    ? 'bg-[#C7F000] text-[#0B0F14]' 
                    : 'bg-[#161B22] text-[#9AA3B2] hover:bg-[#1B212B]'
                }`}
              >
                L
              </button>
              <button 
                onClick={() => setUnit('ml')}
                className={`flex-1 py-2 px-4 font-medium transition-all ${
                  unit === 'ml' 
                    ? 'bg-[#C7F000] text-[#0B0F14]' 
                    : 'bg-[#161B22] text-[#9AA3B2] hover:bg-[#1B212B]'
                }`}
              >
                ml
              </button>
            </div>
          </div>
          
          {/* Current Amount Controls */}
          <div className="mb-6">
            <label className="text-sm font-medium text-[#9AA3B2] mb-3 block">
              Add Water
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button 
                  onClick={() => handleIncrement(0.25)}
                  className="flex-1 bg-[#C7F000] hover:bg-[#B8E000] text-[#0B0F14] py-3 px-4 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95"
                >
                  +{getIncrement(0.25)}{unit}
                </button>
                <button 
                  onClick={() => handleIncrement(0.5)}
                  className="flex-1 bg-[#C7F000] hover:bg-[#B8E000] text-[#0B0F14] py-3 px-4 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95"
                >
                  +{getIncrement(0.5)}{unit}
                </button>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleIncrement(-0.25)}
                  className="flex-1 bg-[#6B7280] hover:bg-[#4B5563] text-white py-3 px-4 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95"
                >
                  -{getIncrement(0.25)}{unit}
                </button>
                <button 
                  onClick={() => handleIncrement(-0.5)}
                  className="flex-1 bg-[#6B7280] hover:bg-[#4B5563] text-white py-3 px-4 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95"
                >
                  -{getIncrement(0.5)}{unit}
                </button>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="mb-6">
            <label className="text-sm font-medium text-[#9AA3B2] mb-3 block">
              Adjust Level
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={currentAmount}
              onChange={(e) => handleIncrement(Number(e.target.value) - currentAmount)}
              className="w-full h-3 bg-gradient-to-r from-blue-200 to-blue-500 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Reset Button */}
          <button 
            onClick={() => handleIncrement(-currentAmount)}
            className="w-full mt-5 bg-[#6B7280] hover:bg-[#4B5563] text-white py-2 px-4 rounded-lg font-medium transition-all"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
