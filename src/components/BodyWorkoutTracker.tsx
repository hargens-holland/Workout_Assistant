"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, Target, Activity, ChevronRight, Plus } from "lucide-react";

// Map component body parts to database body parts
const BODY_PART_MAP: Record<string, string> = {
    chest: "chest",
    back: "back",
    shoulders: "shoulders",
    biceps: "arms",
    triceps: "arms",
    forearms: "arms",
    abs: "core",
    quads: "legs",
    hamstrings: "legs",
    glutes: "legs",
    calves: "legs",
    traps: "shoulders",
    lats: "back",
    rearDelts: "shoulders",
    lowerBack: "back",
};

// Reverse map: database body part -> component body parts
const DB_TO_COMPONENT_MAP: Record<string, string[]> = {
    chest: ["chest"],
    back: ["back", "lats", "lowerBack"],
    shoulders: ["shoulders", "traps", "rearDelts"],
    arms: ["biceps", "triceps", "forearms"],
    core: ["abs"],
    legs: ["quads", "hamstrings", "glutes", "calves"],
};

// Calculate statistics for each body part
const calculateStats = (bodyPart: string, workoutData: any) => {
    if (!workoutData || !workoutData.workouts) return { maxLift: 0, average: 0, growth: 0 };

    let allWeights: number[] = [];
    let growthRates: number[] = [];

    Object.values(workoutData.workouts).forEach((workout: any) => {
        if (Array.isArray(workout)) {
            workout.forEach((entry: any) => allWeights.push(entry.weight));
            if (workout.length >= 2) {
                const firstWeight = workout[0].weight;
                const lastWeight = workout[workout.length - 1].weight;
                const growthPercent = firstWeight > 0 ? ((lastWeight - firstWeight) / firstWeight) * 100 : 0;
                growthRates.push(growthPercent);
            }
        }
    });

    return {
        maxLift: allWeights.length > 0 ? Math.max(...allWeights) : 0,
        average: allWeights.length > 0 ? allWeights.reduce((a, b) => a + b, 0) / allWeights.length : 0,
        growth: growthRates.length > 0 ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0
    };
};

// Muscle point positions for front and back view
const musclePoints = {
    front: [
        { id: 'shoulders', x: 28, y: 20, label: 'L Shoulder' },
        { id: 'shoulders', x: 72, y: 20, label: 'R Shoulder' },
        { id: 'chest', x: 38, y: 28, label: 'L Pec' },
        { id: 'chest', x: 62, y: 28, label: 'R Pec' },
        { id: 'biceps', x: 18, y: 35, label: 'L Bicep' },
        { id: 'biceps', x: 82, y: 35, label: 'R Bicep' },
        { id: 'forearms', x: 14, y: 50, label: 'L Forearm' },
        { id: 'forearms', x: 86, y: 50, label: 'R Forearm' },
        { id: 'abs', x: 50, y: 42, label: 'Core' },
        { id: 'quads', x: 40, y: 75, label: 'L Quad' },
        { id: 'quads', x: 60, y: 75, label: 'R Quad' },
        { id: 'calves', x: 38, y: 98, label: 'L Calf' },
        { id: 'calves', x: 62, y: 98, label: 'R Calf' },
    ],
    back: [
        { id: 'traps', x: 50, y: 18, label: 'Traps' },
        { id: 'rearDelts', x: 30, y: 22, label: 'L Rear Delt' },
        { id: 'rearDelts', x: 70, y: 22, label: 'R Rear Delt' },
        { id: 'lats', x: 35, y: 35, label: 'L Lat' },
        { id: 'lats', x: 65, y: 35, label: 'R Lat' },
        { id: 'triceps', x: 18, y: 38, label: 'L Tricep' },
        { id: 'triceps', x: 82, y: 38, label: 'R Tricep' },
        { id: 'lowerBack', x: 50, y: 48, label: 'Lower Back' },
        { id: 'glutes', x: 40, y: 60, label: 'L Glute' },
        { id: 'glutes', x: 60, y: 60, label: 'R Glute' },
        { id: 'hamstrings', x: 40, y: 78, label: 'L Ham' },
        { id: 'hamstrings', x: 60, y: 78, label: 'R Ham' },
        { id: 'calves', x: 38, y: 98, label: 'L Calf' },
        { id: 'calves', x: 62, y: 98, label: 'R Calf' },
    ]
};

interface BodyWorkoutTrackerProps {
    userId: string;
}

export default function BodyWorkoutTracker({ userId }: BodyWorkoutTrackerProps) {
    const { user } = useUser();
    const [mode, setMode] = useState<'maxLift' | 'average' | 'growth'>('maxLift');
    const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
    const [graphWorkout, setGraphWorkout] = useState<{ bodyPart: string; workout: string } | null>(null);
    const [showGraph, setShowGraph] = useState(false);
    const [showLogModal, setShowLogModal] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<{ id: string; name: string } | null>(null);
    const [logWeight, setLogWeight] = useState("");
    const [logReps, setLogReps] = useState("");
    const [viewMode, setViewMode] = useState<'front' | 'back'>('front');

    // Fetch workout history
    const workoutHistory = useQuery(
        api.plans.getBodyPartWorkoutHistory,
        userId ? { userId: userId as any } : "skip"
    );

    // Fetch exercises for selected body part
    const dbBodyPart = selectedBodyPart ? BODY_PART_MAP[selectedBodyPart] : null;
    const exercises = useQuery(
        api.plans.getExercisesByBodyPart,
        dbBodyPart ? { bodyPart: dbBodyPart } : "skip"
    );

    // Fetch all exercises for comprehensive dropdown
    const allExercises = useQuery(api.plans.getAllExercises);

    const logWorkout = useMutation(api.plans.logBodyTrackerWorkout);

    // Transform workout history to match component format
    const workoutDatabase = useMemo(() => {
        if (!workoutHistory || typeof workoutHistory !== 'object') return {};
        
        const result: Record<string, { name: string; workouts: Record<string, Array<{ date: string; weight: number; reps: number }>> }> = {};
        
        // For each component body part, aggregate data from mapped database body parts
        Object.keys(BODY_PART_MAP).forEach((componentPart) => {
            const dbPart = BODY_PART_MAP[componentPart];
            const dbData = workoutHistory[dbPart];
            
            if (dbData && dbData.workouts) {
                if (!result[componentPart]) {
                    result[componentPart] = {
                        name: componentPart.charAt(0).toUpperCase() + componentPart.slice(1).replace(/([A-Z])/g, ' $1'),
                        workouts: {}
                    };
                }
                
                // Merge workouts from database
                Object.entries(dbData.workouts).forEach(([exerciseName, entries]) => {
                    result[componentPart].workouts[exerciseName] = entries as Array<{ date: string; weight: number; reps: number }>;
                });
            } else if (!result[componentPart]) {
                result[componentPart] = {
                    name: componentPart.charAt(0).toUpperCase() + componentPart.slice(1).replace(/([A-Z])/g, ' $1'),
                    workouts: {}
                };
            }
        });
        
        return result;
    }, [workoutHistory]);

    // Calculate rankings for heat map
    const rankings = useMemo(() => {
        const stats: Record<string, { maxLift: number; average: number; growth: number; rank: number; colorPercent: number }> = {};
        
        Object.keys(workoutDatabase).forEach(part => {
            stats[part] = calculateStats(part, workoutDatabase[part]);
        });
        
        const values = Object.entries(stats).map(([part, s]) => ({
            part,
            value: mode === 'maxLift' ? s.maxLift : mode === 'average' ? s.average : s.growth
        }));
        
        values.sort((a, b) => b.value - a.value);
        
        const ranked: Record<string, { maxLift: number; average: number; growth: number; rank: number; colorPercent: number }> = {};
        values.forEach((item, index) => {
            const percent = values.length > 1 ? (index / (values.length - 1)) : 0;
            ranked[item.part] = {
                ...stats[item.part],
                rank: index + 1,
                colorPercent: percent
            };
        });
        
        return ranked;
    }, [mode, workoutDatabase]);
    
    // Get color based on ranking - uses CSS variables for theme compatibility
    const getHeatColor = (bodyPart: string) => {
        if (!rankings[bodyPart]) return 'hsl(var(--muted-foreground))';
        const percent = rankings[bodyPart].colorPercent;
        // Green (good) -> Yellow (medium) -> Red (needs work)
        if (percent < 0.33) {
            return 'hsl(142, 76%, 36%)'; // green
        } else if (percent < 0.66) {
            return 'hsl(48, 96%, 53%)'; // yellow
        } else {
            return 'hsl(var(--primary))'; // primary color (usually a brand color)
        }
    };
    
    const graphData = useMemo(() => {
        if (!graphWorkout || !workoutDatabase[graphWorkout.bodyPart]) return [];
        const workout = workoutDatabase[graphWorkout.bodyPart].workouts[graphWorkout.workout];
        if (!workout) return [];
        return workout.map(entry => ({
            ...entry,
            displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }));
    }, [graphWorkout, workoutDatabase]);

    // Calculate improvement metrics for the selected exercise
    const improvementMetrics = useMemo(() => {
        if (!graphData || graphData.length === 0) return null;
        
        const firstWeight = graphData[0].weight;
        const lastWeight = graphData[graphData.length - 1].weight;
        const maxWeight = Math.max(...graphData.map(d => d.weight));
        const minWeight = Math.min(...graphData.map(d => d.weight));
        const avgWeight = graphData.reduce((sum, d) => sum + d.weight, 0) / graphData.length;
        
        const improvement = lastWeight - firstWeight;
        const improvementPercent = firstWeight > 0 ? ((improvement / firstWeight) * 100) : 0;
        const improvementPerSession = graphData.length > 1 ? improvement / (graphData.length - 1) : 0;
        
        return {
            firstWeight,
            lastWeight,
            maxWeight,
            minWeight,
            avgWeight,
            improvement,
            improvementPercent,
            improvementPerSession,
            totalSessions: graphData.length
        };
    }, [graphData]);

    // Get all exercises for dropdown (including ones without data) - from selected body part
    const allExercisesForGraph = useMemo(() => {
        if (!exercises || !selectedBodyPart) return [];
        return exercises.map(exercise => ({
            bodyPart: selectedBodyPart,
            workout: exercise.name,
            label: exercise.name,
            exerciseId: exercise._id,
            hasData: (workoutDatabase[selectedBodyPart]?.workouts[exercise.name]?.length || 0) > 0
        }));
    }, [exercises, selectedBodyPart, workoutDatabase]);

    // Get all exercises across all body parts for comprehensive dropdown
    const allExercisesAllBodyParts = useMemo(() => {
        const exerciseList: Array<{ bodyPart: string; workout: string; label: string; exerciseId: string; hasData: boolean }> = [];
        const seenExercises = new Set<string>();
        
        // First, add all exercises that have workout data
        Object.entries(workoutDatabase).forEach(([bodyPart, data]) => {
            Object.keys(data.workouts).forEach(workout => {
                const key = `${bodyPart}|${workout}`;
                if (!seenExercises.has(key)) {
                    seenExercises.add(key);
                    exerciseList.push({
                        bodyPart,
                        workout,
                        label: `${workout} (${data.name})`,
                        exerciseId: '',
                        hasData: true
                    });
                }
            });
        });
        
        // Then add all exercises from database that don't have data yet
        if (allExercises) {
            allExercises.forEach(exercise => {
                // Map database body part to component body part
                const componentBodyPart = Object.entries(BODY_PART_MAP).find(
                    ([_, dbPart]) => dbPart === exercise.bodyPart.toLowerCase()
                )?.[0] || exercise.bodyPart.toLowerCase();
                
                const key = `${componentBodyPart}|${exercise.name}`;
                if (!seenExercises.has(key)) {
                    seenExercises.add(key);
                    const hasData = workoutDatabase[componentBodyPart]?.workouts[exercise.name]?.length > 0;
                    exerciseList.push({
                        bodyPart: componentBodyPart,
                        workout: exercise.name,
                        label: `${exercise.name} (${workoutDatabase[componentBodyPart]?.name || exercise.bodyPart})`,
                        exerciseId: exercise._id,
                        hasData
                    });
                }
            });
        }
        
        // Sort by name
        return exerciseList.sort((a, b) => a.workout.localeCompare(b.workout));
    }, [workoutDatabase, allExercises]);

    // Legacy: workouts with existing data (for backward compatibility)
    const allWorkouts = useMemo(() => {
        const workouts: Array<{ bodyPart: string; workout: string; label: string }> = [];
        Object.entries(workoutDatabase).forEach(([bodyPart, data]) => {
            Object.keys(data.workouts).forEach(workout => {
                workouts.push({ bodyPart, workout, label: `${workout} (${data.name})` });
            });
        });
        return workouts;
    }, [workoutDatabase]);

    const handleLogWorkout = async () => {
        if (!selectedExercise || !logWeight || !logReps || !userId) return;
        
        try {
            await logWorkout({
                userId: userId as any,
                date: new Date().toISOString().split("T")[0],
                exerciseId: selectedExercise.id as any,
                weight: parseFloat(logWeight),
                reps: parseInt(logReps),
            });
            setShowLogModal(false);
            setSelectedExercise(null);
            setLogWeight("");
            setLogReps("");
            
            // Refresh the graph if it's showing the exercise we just logged
            if (graphWorkout && graphWorkout.workout === selectedExercise.name) {
                // The query will automatically refresh, but we can force a re-render
                setShowGraph(false);
                setTimeout(() => {
                    setShowGraph(true);
                }, 100);
            }
        } catch (error) {
            alert("Failed to log workout");
        }
    };

    const MusclePoint = ({ point, viewType }: { point: typeof musclePoints.front[0]; viewType: 'front' | 'back' }) => {
        const isHovered = hoveredPoint === `${viewType}-${point.label}`;
        const isSelected = selectedBodyPart === point.id;
        const color = getHeatColor(point.id);
        const hasData = rankings[point.id]?.maxLift > 0;

        return (
            <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(`${viewType}-${point.label}`)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => setSelectedBodyPart(point.id)}
            >
                {/* Outer ring on hover/select */}
                <circle
                    cx={`${point.x}%`}
                    cy={`${point.y}%`}
                    r={isHovered || isSelected ? "12" : "8"}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={isHovered || isSelected ? "2" : "1"}
                    opacity={isHovered || isSelected ? 0.8 : 0.4}
                    className="transition-all duration-200"
                />

                {/* Main dot */}
                <circle
                    cx={`${point.x}%`}
                    cy={`${point.y}%`}
                    r={isHovered || isSelected ? "6" : "4"}
                    fill={hasData ? color : 'hsl(var(--muted))'}
                    className="transition-all duration-200"
                    style={{
                        filter: isHovered || isSelected ? `drop-shadow(0 0 6px ${color})` : 'none',
                    }}
                />

                {/* Center highlight */}
                <circle
                    cx={`${point.x}%`}
                    cy={`${point.y}%`}
                    r="1.5"
                    fill="white"
                    opacity={hasData ? 0.9 : 0.5}
                />

                {/* Tooltip on hover */}
                {isHovered && (
                    <g>
                        <rect
                            x={`${point.x - 10}%`}
                            y={`${point.y - 9}%`}
                            width="20%"
                            height="5%"
                            rx="3"
                            fill="hsl(var(--popover))"
                            stroke="hsl(var(--border))"
                            strokeWidth="1"
                        />
                        <text
                            x={`${point.x}%`}
                            y={`${point.y - 5.5}%`}
                            textAnchor="middle"
                            fill="hsl(var(--popover-foreground))"
                            fontSize="9"
                            fontWeight="500"
                        >
                            {point.label}
                        </text>
                    </g>
                )}
            </g>
        );
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0f',
            fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
            color: '#e2e8f0',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap');
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.3; }
                    50% { transform: scale(1.3); opacity: 0; }
                }
                
                @keyframes scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100vh); }
                }
                
                .grid-bg {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: 
                        linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px);
                    background-size: 50px 50px;
                    pointer-events: none;
                    z-index: 0;
                }
                
                .scanline {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(180deg, transparent, rgba(0, 255, 255, 0.1), transparent);
                    animation: scanline 8s linear infinite;
                    pointer-events: none;
                    z-index: 1;
                }
                
                .mode-btn {
                    padding: 10px 20px;
                    border: 1px solid rgba(0, 255, 255, 0.3);
                    border-radius: 4px;
                    font-family: 'Orbitron', sans-serif;
                    font-weight: 500;
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    position: relative;
                    overflow: hidden;
                }
                
                .mode-btn.active {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%);
                    border-color: #ef4444;
                    color: #ef4444;
                    box-shadow: 0 0 20px rgba(239, 68, 68, 0.3), inset 0 0 20px rgba(239, 68, 68, 0.1);
                }
                
                .mode-btn.inactive {
                    background: rgba(255, 255, 255, 0.02);
                    color: #64748b;
                }
                
                .mode-btn.inactive:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(0, 255, 255, 0.5);
                    color: #00ffff;
                }
                
                .workout-card {
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(0, 255, 255, 0.1);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: visible;
                }
                
                .workout-card:hover {
                    background: rgba(239, 68, 68, 0.05);
                    border-color: rgba(239, 68, 68, 0.3);
                    transform: translateX(4px);
                }
                
                .hud-corner {
                    position: absolute;
                    width: 20px;
                    height: 20px;
                    border-color: rgba(0, 255, 255, 0.3);
                    border-style: solid;
                }
                
                .hud-corner.tl { top: 0; left: 0; border-width: 2px 0 0 2px; }
                .hud-corner.tr { top: 0; right: 0; border-width: 2px 2px 0 0; }
                .hud-corner.bl { bottom: 0; left: 0; border-width: 0 0 2px 2px; }
                .hud-corner.br { bottom: 0; right: 0; border-width: 0 2px 2px 0; }
            `}</style>
            
            <div className="grid-bg" />
            <div className="scanline" />
            
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
                <div style={{ 
                    fontSize: '10px', 
                    color: '#00ffff', 
                    letterSpacing: '8px', 
                    marginBottom: '8px',
                    fontFamily: "'Orbitron', sans-serif"
                }}>
                    NEURAL INTERFACE v2.4
                </div>
                <h1 style={{
                    fontSize: '36px',
                    fontWeight: '900',
                    fontFamily: "'Orbitron', sans-serif",
                    background: 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: '0 0 4px 0',
                    letterSpacing: '4px'
                }}>
                    BODY ANALYTICS
                </h1>
                <div style={{ 
                    color: '#475569', 
                    fontSize: '11px', 
                    letterSpacing: '3px',
                    fontFamily: "'Rajdhani', sans-serif"
                }}>
                    PERFORMANCE MONITORING SYSTEM
                </div>
            </div>
            
            {/* Mode Selector */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '24px',
                flexWrap: 'wrap',
                position: 'relative',
                zIndex: 10
            }}>
                <button 
                    className={`mode-btn ${mode === 'maxLift' ? 'active' : 'inactive'}`}
                    onClick={() => setMode('maxLift')}
                >
                    Max Lift
                </button>
                <button 
                    className={`mode-btn ${mode === 'average' ? 'active' : 'inactive'}`}
                    onClick={() => setMode('average')}
                >
                    Averages
                </button>
                <button 
                    className={`mode-btn ${mode === 'growth' ? 'active' : 'inactive'}`}
                    onClick={() => setMode('growth')}
                >
                    Growth Rate
                </button>
            </div>
            
            {/* Main Content */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                maxWidth: '1400px',
                margin: '0 auto',
                position: 'relative',
                zIndex: 10
            }}>
                
                {/* Body Diagrams */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px'
                }}>
                    {/* Front View */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 255, 255, 0.1)',
                        padding: '20px',
                        position: 'relative',
                        minHeight: '600px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div className="hud-corner tl" />
                        <div className="hud-corner tr" />
                        <div className="hud-corner bl" />
                        <div className="hud-corner br" />
                        
                        <div style={{ 
                            textAlign: 'center', 
                            marginBottom: '12px',
                            fontSize: '10px',
                            letterSpacing: '3px',
                            color: '#00ffff',
                            fontFamily: "'Orbitron', sans-serif"
                        }}>
                            ANTERIOR VIEW
                        </div>
                        
                        <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', flex: 1, minHeight: '500px' }}>
                            <defs>
                                <linearGradient id="bodyGradientFront" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#1a1a2e" />
                                    <stop offset="100%" stopColor="#0f0f1a" />
                                </linearGradient>
                            </defs>
                            
                            <ellipse cx="50" cy="8" rx="8" ry="8" fill="url(#bodyGradientFront)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <rect x="46" y="15" width="8" height="5" fill="url(#bodyGradientFront)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M30 20 L70 20 L75 26 L73 55 L65 62 L35 62 L27 55 L25 26 Z" 
                                fill="url(#bodyGradientFront)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M25 22 L18 25 L12 42 L10 58 L15 60 L20 45 L25 28" 
                                fill="url(#bodyGradientFront)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M75 22 L82 25 L88 42 L90 58 L85 60 L80 45 L75 28" 
                                fill="url(#bodyGradientFront)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M35 62 L65 62 L68 68 L62 72 L38 72 L32 68 Z" 
                                fill="url(#bodyGradientFront)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M38 72 L35 92 L33 112 L43 114 L46 94 L48 72" 
                                fill="url(#bodyGradientFront)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M52 72 L54 94 L57 114 L67 112 L65 92 L62 72" 
                                fill="url(#bodyGradientFront)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            
                            {musclePoints.front.map((point, i) => (
                                <MusclePoint key={`front-${i}`} point={point} viewType="front" />
                            ))}
                        </svg>
                    </div>
                    
                    {/* Back View */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 255, 255, 0.1)',
                        padding: '20px',
                        position: 'relative',
                        minHeight: '600px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div className="hud-corner tl" />
                        <div className="hud-corner tr" />
                        <div className="hud-corner bl" />
                        <div className="hud-corner br" />
                        
                        <div style={{ 
                            textAlign: 'center', 
                            marginBottom: '12px',
                            fontSize: '10px',
                            letterSpacing: '3px',
                            color: '#00ffff',
                            fontFamily: "'Orbitron', sans-serif"
                        }}>
                            POSTERIOR VIEW
                        </div>
                        
                        <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', flex: 1, minHeight: '500px' }}>
                            <defs>
                                <linearGradient id="bodyGradientBack" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#1a1a2e" />
                                    <stop offset="100%" stopColor="#0f0f1a" />
                                </linearGradient>
                            </defs>
                            
                            <ellipse cx="50" cy="8" rx="8" ry="8" fill="url(#bodyGradientBack)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <rect x="46" y="15" width="8" height="5" fill="url(#bodyGradientBack)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M30 20 L70 20 L75 26 L73 55 L65 62 L35 62 L27 55 L25 26 Z" 
                                fill="url(#bodyGradientBack)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M25 22 L18 25 L12 42 L10 58 L15 60 L20 45 L25 28" 
                                fill="url(#bodyGradientBack)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M75 22 L82 25 L88 42 L90 58 L85 60 L80 45 L75 28" 
                                fill="url(#bodyGradientBack)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M35 62 L65 62 L68 68 L62 74 L38 74 L32 68 Z" 
                                fill="url(#bodyGradientBack)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M38 74 L35 92 L33 112 L43 114 L46 94 L48 74" 
                                fill="url(#bodyGradientBack)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            <path d="M52 74 L54 94 L57 114 L67 112 L65 92 L62 74" 
                                fill="url(#bodyGradientBack)" stroke="rgba(0,255,255,0.2)" strokeWidth="0.5" />
                            
                            {musclePoints.back.map((point, i) => (
                                <MusclePoint key={`back-${i}`} point={point} viewType="back" />
                            ))}
                        </svg>
                    </div>
                </div>
                
                {/* Right Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Body Part Detail */}
                    {selectedBodyPart && workoutDatabase[selectedBodyPart] ? (
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.4)',
                            borderRadius: '8px',
                            padding: '20px',
                            border: '1px solid rgba(0, 255, 255, 0.1)',
                            position: 'relative'
                        }}>
                            <div className="hud-corner tl" />
                            <div className="hud-corner tr" />
                            <div className="hud-corner bl" />
                            <div className="hud-corner br" />
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div>
                                    <div style={{ 
                                        fontSize: '10px', 
                                        color: '#00ffff', 
                                        letterSpacing: '2px',
                                        marginBottom: '4px',
                                        fontFamily: "'Orbitron', sans-serif"
                                    }}>
                                        MUSCLE GROUP
                                    </div>
                                    <h2 style={{
                                        margin: 0,
                                        fontSize: '24px',
                                        fontWeight: '700',
                                        color: '#f1f5f9',
                                        fontFamily: "'Orbitron', sans-serif",
                                        letterSpacing: '2px'
                                    }}>
                                        {workoutDatabase[selectedBodyPart].name.toUpperCase()}
                                    </h2>
                                </div>
                                <button 
                                    onClick={() => setSelectedBodyPart(null)}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                            
                            {/* Stats Summary */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '12px',
                                marginBottom: '16px'
                            }}>
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    borderRadius: '4px',
                                    padding: '12px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ color: '#fca5a5', fontSize: '9px', letterSpacing: '2px', marginBottom: '4px' }}>MAX LIFT</div>
                                    <div style={{ fontFamily: 'Orbitron', fontWeight: '700', color: '#ef4444', fontSize: '20px' }}>
                                        {rankings[selectedBodyPart]?.maxLift.toFixed(0) || 0}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '10px' }}>LBS</div>
                                </div>
                                <div style={{
                                    background: 'rgba(0, 255, 255, 0.05)',
                                    border: '1px solid rgba(0, 255, 255, 0.2)',
                                    borderRadius: '4px',
                                    padding: '12px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ color: '#67e8f9', fontSize: '9px', letterSpacing: '2px', marginBottom: '4px' }}>AVERAGE</div>
                                    <div style={{ fontFamily: 'Orbitron', fontWeight: '700', color: '#00ffff', fontSize: '20px' }}>
                                        {rankings[selectedBodyPart]?.average.toFixed(0) || 0}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '10px' }}>LBS</div>
                                </div>
                                <div style={{
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    border: '1px solid rgba(34, 197, 94, 0.2)',
                                    borderRadius: '4px',
                                    padding: '12px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ color: '#86efac', fontSize: '9px', letterSpacing: '2px', marginBottom: '4px' }}>GROWTH</div>
                                    <div style={{ fontFamily: 'Orbitron', fontWeight: '700', color: '#22c55e', fontSize: '20px' }}>
                                        +{rankings[selectedBodyPart]?.growth.toFixed(1) || 0}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '10px' }}>%</div>
                                </div>
                            </div>
                            
                            {/* Exercises List */}
                            <div style={{ 
                                fontSize: '9px', 
                                color: '#64748b', 
                                letterSpacing: '2px', 
                                marginBottom: '8px',
                                fontFamily: "'Orbitron', sans-serif"
                            }}>
                                AVAILABLE EXERCISES
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                                {exercises && exercises.length > 0 ? (
                                    exercises.map((exercise) => {
                                        const workoutData = workoutDatabase[selectedBodyPart]?.workouts[exercise.name] || [];
                                        const maxWeight = workoutData.length > 0 ? Math.max(...workoutData.map((d: any) => d.weight)) : 0;
                                        const growth = workoutData.length >= 2 ? ((workoutData[workoutData.length-1].weight - workoutData[0].weight) / workoutData[0].weight * 100).toFixed(1) : 0;
                                        
                                        return (
                                            <div 
                                                key={exercise._id}
                                                className="workout-card"
                                                onClick={() => {
                                                    setGraphWorkout({ bodyPart: selectedBodyPart, workout: exercise.name });
                                                    setShowGraph(true);
                                                }}
                                                style={{
                                                    minHeight: '70px',
                                                    padding: '16px 18px',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{exercise.name}</div>
                                                        <div style={{ color: '#475569', fontSize: '11px' }}>
                                                            {workoutData.length > 0 ? `${workoutData.length} sessions` : 'No data yet • Click to view graph'}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                                                        {maxWeight > 0 && (
                                                            <>
                                                                <span style={{
                                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                                    color: '#fca5a5',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    fontFamily: "'Orbitron', sans-serif",
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {maxWeight}lbs
                                                                </span>
                                                                {growth !== 0 && (
                                                                    <span style={{
                                                                        background: 'rgba(34, 197, 94, 0.15)',
                                                                        color: '#86efac',
                                                                        padding: '6px 12px',
                                                                        borderRadius: '4px',
                                                                        fontSize: '11px',
                                                                        fontWeight: '600',
                                                                        fontFamily: "'Orbitron', sans-serif",
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        +{growth}%
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedExercise({ id: exercise._id, name: exercise.name });
                                                                setShowLogModal(true);
                                                            }}
                                                            style={{
                                                                padding: '8px 16px',
                                                                background: 'rgba(239, 68, 68, 0.2)',
                                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                borderRadius: '4px',
                                                                color: '#fca5a5',
                                                                fontSize: '11px',
                                                                fontWeight: '600',
                                                                cursor: 'pointer',
                                                                fontFamily: "'Orbitron', sans-serif",
                                                                letterSpacing: '1px',
                                                                transition: 'all 0.3s ease',
                                                                whiteSpace: 'nowrap',
                                                                flexShrink: 0
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                                                e.currentTarget.style.transform = 'scale(1)';
                                                            }}
                                                        >
                                                            + LOG
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                                        No exercises found for this body part
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.4)',
                            borderRadius: '8px',
                            padding: '40px',
                            border: '1px solid rgba(0, 255, 255, 0.1)',
                            textAlign: 'center',
                            position: 'relative'
                        }}>
                            <div className="hud-corner tl" />
                            <div className="hud-corner tr" />
                            <div className="hud-corner bl" />
                            <div className="hud-corner br" />
                            
                            <div style={{ 
                                fontSize: '32px', 
                                marginBottom: '12px',
                                opacity: 0.5
                            }}>⬅</div>
                            <div style={{ 
                                fontSize: '10px', 
                                color: '#00ffff', 
                                letterSpacing: '3px',
                                marginBottom: '8px',
                                fontFamily: "'Orbitron', sans-serif"
                            }}>
                                AWAITING INPUT
                            </div>
                            <p style={{ margin: 0, color: '#475569', fontSize: '13px' }}>
                                Select a muscle point to view exercises and statistics
                            </p>
                        </div>
                    )}
                    
                    {/* Progress Graph Section */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: '8px',
                        padding: '20px',
                        border: '1px solid rgba(0, 255, 255, 0.1)',
                        position: 'relative',
                        flex: 1
                    }}>
                        <div className="hud-corner tl" />
                        <div className="hud-corner tr" />
                        <div className="hud-corner bl" />
                        <div className="hud-corner br" />
                        
                        <div style={{ 
                            fontSize: '10px', 
                            color: '#00ffff', 
                            letterSpacing: '2px',
                            marginBottom: '4px',
                            fontFamily: "'Orbitron', sans-serif"
                        }}>
                            PERFORMANCE TRACKING
                        </div>
                        <h2 style={{
                            margin: '0 0 16px 0',
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#f1f5f9',
                            fontFamily: "'Orbitron', sans-serif"
                        }}>
                            EXERCISE PROGRESS GRAPH
                        </h2>
                        
                        {/* Exercise Selector Dropdown - Show all exercises */}
                        {allExercisesAllBodyParts.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '9px',
                                    color: '#64748b',
                                    letterSpacing: '2px',
                                    marginBottom: '8px',
                                    fontFamily: "'Orbitron', sans-serif"
                                }}>
                                    SELECT EXERCISE
                                </label>
                                <select 
                                    style={{
                                        background: 'rgba(0, 0, 0, 0.6)',
                                        border: '1px solid rgba(0, 255, 255, 0.2)',
                                        borderRadius: '4px',
                                        padding: '12px 16px',
                                        color: '#e2e8f0',
                                        fontFamily: "'Rajdhani', sans-serif",
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        width: '100%',
                                        cursor: 'pointer',
                                        appearance: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2300ffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 12px center',
                                        backgroundSize: '16px'
                                    }}
                                    value={graphWorkout ? `${graphWorkout.bodyPart}|${graphWorkout.workout}` : ''}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            const [bodyPart, workout] = e.target.value.split('|');
                                            setGraphWorkout({ bodyPart, workout });
                                            setShowGraph(true);
                                        } else {
                                            setGraphWorkout(null);
                                            setShowGraph(false);
                                        }
                                    }}
                                >
                                    <option value="">Select exercise to view progress...</option>
                                    {allExercisesAllBodyParts.map((item) => (
                                        <option key={`${item.bodyPart}-${item.workout}`} value={`${item.bodyPart}|${item.workout}`}>
                                            {item.label} {item.hasData ? '✓' : '(no data)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        {showGraph && graphData.length > 0 && improvementMetrics ? (
                            <div>
                                {/* Exercise Name and Improvement Stats */}
                                <div style={{ marginBottom: '16px' }}>
                                    <h3 style={{
                                        margin: '0 0 12px 0',
                                        fontSize: '16px',
                                        fontWeight: '700',
                                        color: '#f1f5f9',
                                        fontFamily: "'Orbitron', sans-serif",
                                        letterSpacing: '1px'
                                    }}>
                                        {graphWorkout?.workout.toUpperCase()}
                                    </h3>
                                    
                                    {/* Improvement Stats Grid */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '8px',
                                        marginBottom: '12px'
                                    }}>
                                        <div style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            borderRadius: '4px',
                                            padding: '10px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ color: '#fca5a5', fontSize: '8px', letterSpacing: '1px', marginBottom: '4px' }}>STARTING WEIGHT</div>
                                            <div style={{ fontFamily: 'Orbitron', fontWeight: '700', color: '#ef4444', fontSize: '16px' }}>
                                                {improvementMetrics.firstWeight.toFixed(0)}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '9px' }}>LBS</div>
                                        </div>
                                        
                                        <div style={{
                                            background: 'rgba(34, 197, 94, 0.1)',
                                            border: '1px solid rgba(34, 197, 94, 0.2)',
                                            borderRadius: '4px',
                                            padding: '10px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ color: '#86efac', fontSize: '8px', letterSpacing: '1px', marginBottom: '4px' }}>CURRENT WEIGHT</div>
                                            <div style={{ fontFamily: 'Orbitron', fontWeight: '700', color: '#22c55e', fontSize: '16px' }}>
                                                {improvementMetrics.lastWeight.toFixed(0)}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '9px' }}>LBS</div>
                                        </div>
                                        
                                        <div style={{
                                            background: 'rgba(0, 255, 255, 0.1)',
                                            border: '1px solid rgba(0, 255, 255, 0.2)',
                                            borderRadius: '4px',
                                            padding: '10px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ color: '#67e8f9', fontSize: '8px', letterSpacing: '1px', marginBottom: '4px' }}>BEST LIFT</div>
                                            <div style={{ fontFamily: 'Orbitron', fontWeight: '700', color: '#00ffff', fontSize: '16px' }}>
                                                {improvementMetrics.maxWeight.toFixed(0)}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '9px' }}>LBS</div>
                                        </div>
                                        
                                        <div style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            borderRadius: '4px',
                                            padding: '10px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ color: '#fca5a5', fontSize: '8px', letterSpacing: '1px', marginBottom: '4px' }}>IMPROVEMENT</div>
                                            <div style={{ fontFamily: 'Orbitron', fontWeight: '700', color: improvementMetrics.improvement >= 0 ? '#22c55e' : '#ef4444', fontSize: '16px' }}>
                                                {improvementMetrics.improvement >= 0 ? '+' : ''}{improvementMetrics.improvement.toFixed(0)}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '9px' }}>LBS ({improvementMetrics.improvementPercent >= 0 ? '+' : ''}{improvementMetrics.improvementPercent.toFixed(1)}%)</div>
                                        </div>
                                    </div>
                                    
                                    {/* Additional Stats */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 12px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(0, 255, 255, 0.1)'
                                    }}>
                                        <div>
                                            <span style={{ color: '#64748b', fontSize: '10px', marginRight: '8px' }}>Total Sessions:</span>
                                            <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: '600' }}>{improvementMetrics.totalSessions}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b', fontSize: '10px', marginRight: '8px' }}>Avg Weight:</span>
                                            <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: '600' }}>{improvementMetrics.avgWeight.toFixed(0)} lbs</span>
                                        </div>
                                        {improvementMetrics.totalSessions > 1 && (
                                            <div>
                                                <span style={{ color: '#64748b', fontSize: '10px', marginRight: '8px' }}>Per Session:</span>
                                                <span style={{ color: improvementMetrics.improvementPerSession >= 0 ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: '600' }}>
                                                    {improvementMetrics.improvementPerSession >= 0 ? '+' : ''}{improvementMetrics.improvementPerSession.toFixed(1)} lbs
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ height: '220px', marginTop: '12px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={graphData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.05)" />
                                            <XAxis 
                                                dataKey="displayDate" 
                                                stroke="#475569"
                                                tick={{ fill: '#475569', fontSize: 10 }}
                                                axisLine={{ stroke: 'rgba(0,255,255,0.1)' }}
                                            />
                                            <YAxis 
                                                stroke="#475569"
                                                tick={{ fill: '#475569', fontSize: 10 }}
                                                axisLine={{ stroke: 'rgba(0,255,255,0.1)' }}
                                                tickFormatter={(value) => `${value}`}
                                            />
                                            <Tooltip 
                                                contentStyle={{
                                                    background: 'rgba(0, 0, 0, 0.9)',
                                                    border: '1px solid rgba(0,255,255,0.2)',
                                                    borderRadius: '4px',
                                                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                                    fontFamily: "'Rajdhani', sans-serif"
                                                }}
                                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                                formatter={(value: any) => [
                                                    <span key="value" style={{ color: '#ef4444', fontWeight: '600', fontFamily: "'Orbitron', sans-serif" }}>{value} LBS</span>,
                                                    'Weight'
                                                ]}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="weight" 
                                                stroke="#ef4444" 
                                                strokeWidth={2}
                                                fill="url(#weightGradient)"
                                                dot={{ fill: '#ef4444', strokeWidth: 2, r: 3, stroke: '#0a0a0f' }}
                                                activeDot={{ r: 5, stroke: '#ef4444', strokeWidth: 2, fill: '#0a0a0f' }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : showGraph && graphWorkout ? (
                            <div style={{
                                height: '150px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#475569',
                                fontSize: '12px',
                                gap: '12px'
                            }}>
                                <div style={{ 
                                    fontSize: '9px', 
                                    color: '#00ffff', 
                                    letterSpacing: '2px',
                                    fontFamily: "'Orbitron', sans-serif"
                                }}>
                                    NO DATA FOR {graphWorkout.workout.toUpperCase()}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '11px', textAlign: 'center', maxWidth: '200px' }}>
                                    Log your first workout for this exercise to see progress tracking
                                </div>
                                <button
                                    onClick={() => {
                                        const exercise = exercises?.find(e => e.name === graphWorkout.workout);
                                        if (exercise) {
                                            setSelectedExercise({ id: exercise._id, name: exercise.name });
                                            setShowLogModal(true);
                                        }
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'rgba(239, 68, 68, 0.2)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '4px',
                                        color: '#fca5a5',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontFamily: "'Orbitron', sans-serif",
                                        letterSpacing: '1px'
                                    }}
                                >
                                    LOG FIRST WORKOUT
                                </button>
                            </div>
                        ) : (
                            <div style={{
                                height: '150px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#475569',
                                fontSize: '12px'
                            }}>
                                <div style={{ 
                                    fontSize: '9px', 
                                    color: '#00ffff', 
                                    letterSpacing: '2px',
                                    marginBottom: '8px',
                                    fontFamily: "'Orbitron', sans-serif",
                                    opacity: 0.5
                                }}>
                                    NO DATA SELECTED
                                </div>
                                {selectedBodyPart ? 'Select an exercise from dropdown above' : 'Select a muscle point to view exercises'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Log Workout Modal */}
            {showLogModal && selectedExercise && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => setShowLogModal(false)}>
                    <div style={{
                        background: 'rgba(10, 10, 15, 0.95)',
                        border: '1px solid rgba(0, 255, 255, 0.3)',
                        borderRadius: '8px',
                        padding: '24px',
                        minWidth: '300px',
                        maxWidth: '500px'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#f1f5f9',
                            fontFamily: "'Orbitron', sans-serif",
                            marginBottom: '16px'
                        }}>
                            Log Workout: {selectedExercise.name}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                                    Weight (lbs)
                                </label>
                                <input
                                    type="number"
                                    value={logWeight}
                                    onChange={(e) => setLogWeight(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(0, 255, 255, 0.2)',
                                        borderRadius: '4px',
                                        color: '#e2e8f0',
                                        fontSize: '14px'
                                    }}
                                    placeholder="Enter weight"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                                    Reps
                                </label>
                                <input
                                    type="number"
                                    value={logReps}
                                    onChange={(e) => setLogReps(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(0, 255, 255, 0.2)',
                                        borderRadius: '4px',
                                        color: '#e2e8f0',
                                        fontSize: '14px'
                                    }}
                                    placeholder="Enter reps"
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowLogModal(false);
                                    setSelectedExercise(null);
                                    setLogWeight("");
                                    setLogReps("");
                                }}
                                style={{
                                    padding: '8px 16px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '4px',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLogWorkout}
                                disabled={!logWeight || !logReps}
                                style={{
                                    padding: '8px 16px',
                                    background: logWeight && logReps ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    border: logWeight && logReps ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '4px',
                                    color: logWeight && logReps ? '#ef4444' : '#64748b',
                                    cursor: logWeight && logReps ? 'pointer' : 'not-allowed',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                }}
                            >
                                Log Workout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
