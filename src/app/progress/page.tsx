"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import CornerElements from "@/components/CornerElements";
import { TrendingUpIcon, TargetIcon, CalendarIcon, ActivityIcon } from "lucide-react";
import Link from "next/link";

const ProgressPage = () => {
    const { user } = useUser();
    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const activePlan = useQuery(
        api.plans.getActivePlan,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const allExerciseProgress = useQuery(
        api.plans.getAllExerciseProgress,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const selectedExerciseProgress = useQuery(
        api.plans.getExerciseProgress,
        selectedExerciseId && convexUser?._id
            ? { userId: convexUser._id, exerciseId: selectedExerciseId as any }
            : "skip"
    );

    const bodyPartStrength = useQuery(
        api.plans.getBodyPartStrength,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    // Calculate goal progress
    const goalProgress = useMemo(() => {
        if (!activePlan?.trainingStrategy) return null;

        const strategy = activePlan.trainingStrategy as any;
        const planStartDate = new Date(activePlan._creationTime);
        const now = new Date();
        const weeksElapsed = Math.floor((now.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const totalWeeks = strategy.time_horizon_weeks || 12;
        const progressPercent = Math.min(100, Math.max(0, (weeksElapsed / totalWeeks) * 100));

        return {
            goal: strategy.goal_type || "No specific goal",
            primaryFocus: strategy.primary_focus || "General fitness",
            weeksElapsed,
            totalWeeks,
            progressPercent,
            weeksRemaining: Math.max(0, totalWeeks - weeksElapsed),
        };
    }, [activePlan]);

    // Project future goal achievement
    const goalProjection = useMemo(() => {
        if (!goalProgress || !selectedExerciseProgress || selectedExerciseProgress.length < 2) return null;

        const recentProgress = selectedExerciseProgress.slice(-4); // Last 4 sessions
        if (recentProgress.length < 2) return null;

        const weights = recentProgress.map((p) => p.maxWeight);
        const dates = recentProgress.map((p) => new Date(p.date).getTime());

        // Simple linear regression for projection
        const n = weights.length;
        const sumX = dates.reduce((a, b) => a + b, 0);
        const sumY = weights.reduce((a, b) => a + b, 0);
        const sumXY = dates.reduce((sum, x, i) => sum + x * weights[i], 0);
        const sumXX = dates.reduce((sum, x) => sum + x * x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Project 4 weeks ahead
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 28);
        const projectedWeight = slope * futureDate.getTime() + intercept;

        const currentWeight = weights[weights.length - 1];
        const weeklyGain = slope * (7 * 24 * 60 * 60 * 1000); // Weight gain per week

        return {
            currentWeight: Math.round(currentWeight),
            projectedWeight: Math.round(Math.max(currentWeight, projectedWeight)),
            weeklyGain: Math.round(weeklyGain * 10) / 10,
            weeksToReach: weeklyGain > 0 ? Math.ceil((projectedWeight - currentWeight) / weeklyGain) : null,
        };
    }, [selectedExerciseProgress, goalProgress]);

    // Get top exercises by latest weight
    const topExercises = useMemo(() => {
        if (!allExerciseProgress) return [];
        return [...allExerciseProgress]
            .filter((e) => e.latestWeight > 0)
            .sort((a, b) => b.latestWeight - a.latestWeight)
            .slice(0, 10);
    }, [allExerciseProgress]);

    // Calculate max volume for body part visualization
    const maxBodyPartVolume = useMemo(() => {
        if (!bodyPartStrength || bodyPartStrength.length === 0) return 1;
        return Math.max(...bodyPartStrength.map((bp) => bp.totalVolume));
    }, [bodyPartStrength]);

    if (!convexUser) {
        return (
            <section className="relative z-10 pt-12 pb-32 flex-grow container mx-auto px-4">
                <div className="text-center text-muted-foreground">Loading...</div>
            </section>
        );
    }

    if (!activePlan) {
        return (
            <section className="relative z-10 pt-12 pb-32 flex-grow container mx-auto px-4">
                <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                    <CornerElements />
                    <div className="text-center">
                        <h2 className="text-xl font-bold mb-4">No Active Plan</h2>
                        <p className="text-muted-foreground mb-4">Create a plan to track progress.</p>
                        <Button asChild>
                            <Link href="/generate-program">Create Plan</Link>
                        </Button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="relative z-10 pt-12 pb-32 flex-grow container mx-auto px-4">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                    <CornerElements />
                    <h1 className="text-2xl font-bold mb-2">
                        <span className="text-primary">Progress</span> Tracking
                    </h1>
                    <p className="text-muted-foreground">Monitor your strength gains and goal progress</p>
                </div>

                {/* Goal Progress */}
                {goalProgress && (
                    <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                        <CornerElements />
                        <div className="flex items-center gap-2 mb-4">
                            <TargetIcon className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold">Goal Progress</h2>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Goal</div>
                                <div className="font-semibold text-lg">{goalProgress.goal}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Primary Focus</div>
                                <div className="font-medium">{goalProgress.primaryFocus}</div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-muted-foreground">Time Progress</span>
                                    <span className="font-semibold">
                                        {goalProgress.weeksElapsed} / {goalProgress.totalWeeks} weeks
                                    </span>
                                </div>
                                <div className="w-full bg-background rounded-full h-4">
                                    <div
                                        className="bg-primary h-4 rounded-full transition-all"
                                        style={{ width: `${goalProgress.progressPercent}%` }}
                                    />
                                </div>
                                {goalProgress.weeksRemaining > 0 && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {goalProgress.weeksRemaining} weeks remaining
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Body Part Strength Visualization */}
                {bodyPartStrength && bodyPartStrength.length > 0 && (
                    <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                        <CornerElements />
                        <div className="flex items-center gap-2 mb-4">
                            <ActivityIcon className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold">Body Part Strength</h2>
                        </div>
                        <div className="space-y-3">
                            {bodyPartStrength.map((bp) => {
                                const strengthPercent = (bp.totalVolume / maxBodyPartVolume) * 100;
                                return (
                                    <div key={bp.bodyPart}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="font-medium capitalize">{bp.bodyPart}</span>
                                            <span className="text-muted-foreground">
                                                {bp.sessions} sessions • {bp.exerciseCount} exercises
                                            </span>
                                        </div>
                                        <div className="w-full bg-background rounded-full h-3">
                                            <div
                                                className="bg-primary h-3 rounded-full"
                                                style={{ width: `${strengthPercent}%` }}
                                            />
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {Math.round(bp.totalVolume).toLocaleString()} lbs total volume
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Exercise Progress Charts */}
                <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                    <CornerElements />
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUpIcon className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-semibold">Exercise Progress</h2>
                    </div>

                    {/* Exercise Selector */}
                    {topExercises.length > 0 && (
                        <div className="mb-6">
                            <div className="text-sm text-muted-foreground mb-2">Select an exercise to view progress:</div>
                            <div className="flex flex-wrap gap-2">
                                {topExercises.map((ex) => (
                                    <Button
                                        key={ex.exercise._id}
                                        variant={selectedExerciseId === ex.exercise._id ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSelectedExerciseId(ex.exercise._id)}
                                    >
                                        {ex.exercise.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Selected Exercise Chart */}
                    {selectedExerciseProgress && selectedExerciseProgress.length > 0 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold mb-3">
                                    {allExerciseProgress?.find((e) => e.exercise._id === selectedExerciseId)?.exercise.name || "Exercise"} Progress
                                </h3>
                                <div className="space-y-4">
                                    {/* Weight Progress Chart */}
                                    <div>
                                        <div className="text-sm text-muted-foreground mb-2">Max Weight Over Time</div>
                                        <div className="flex items-end gap-2 h-48">
                                            {selectedExerciseProgress.map((point, idx) => {
                                                const maxWeight = Math.max(...selectedExerciseProgress.map((p) => p.maxWeight));
                                                const heightPercent = maxWeight > 0 ? (point.maxWeight / maxWeight) * 100 : 0;
                                                return (
                                                    <div key={idx} className="flex-1 flex flex-col items-center">
                                                        <div className="w-full flex flex-col items-center justify-end h-full">
                                                            <div
                                                                className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                                                                style={{ height: `${heightPercent}%` }}
                                                                title={`${point.maxWeight} lbs on ${new Date(point.date).toLocaleDateString()}`}
                                                            />
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                                                            {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Volume Progress */}
                                    <div>
                                        <div className="text-sm text-muted-foreground mb-2">Total Volume Per Session</div>
                                        <div className="space-y-2">
                                            {selectedExerciseProgress.map((point, idx) => {
                                                const maxVolume = Math.max(...selectedExerciseProgress.map((p) => p.totalVolume));
                                                const volumePercent = maxVolume > 0 ? (point.totalVolume / maxVolume) * 100 : 0;
                                                return (
                                                    <div key={idx} className="flex items-center gap-3">
                                                        <div className="w-24 text-xs text-muted-foreground">
                                                            {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                        </div>
                                                        <div className="flex-1 bg-background rounded-full h-4">
                                                            <div
                                                                className="bg-primary h-4 rounded-full"
                                                                style={{ width: `${volumePercent}%` }}
                                                            />
                                                        </div>
                                                        <div className="w-20 text-xs text-right">
                                                            {Math.round(point.totalVolume)} lbs
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Future Projection */}
                            {goalProjection && (
                                <div className="border border-border rounded p-4 bg-background/50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CalendarIcon className="h-4 w-4 text-primary" />
                                        <h4 className="font-semibold">Future Projection</h4>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Current Weight:</span>
                                            <span className="font-semibold">{goalProjection.currentWeight} lbs</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Projected (4 weeks):</span>
                                            <span className="font-semibold text-primary">{goalProjection.projectedWeight} lbs</span>
                                        </div>
                                        {goalProjection.weeklyGain > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Weekly Gain:</span>
                                                <span className="font-semibold text-green-500">+{goalProjection.weeklyGain} lbs/week</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedExerciseId && (!selectedExerciseProgress || selectedExerciseProgress.length === 0) && (
                        <div className="text-center text-muted-foreground py-8">
                            No completed sets found for this exercise yet.
                        </div>
                    )}

                    {!selectedExerciseId && topExercises.length > 0 && (
                        <div className="text-center text-muted-foreground py-8">
                            Select an exercise above to view detailed progress.
                        </div>
                    )}

                    {topExercises.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                            Complete some workouts to see your progress here.
                        </div>
                    )}
                </div>

                {/* Top Exercises Summary */}
                {topExercises.length > 0 && (
                    <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                        <CornerElements />
                        <h2 className="text-xl font-semibold mb-4">Top Exercises</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {topExercises.slice(0, 6).map((ex) => (
                                <div
                                    key={ex.exercise._id}
                                    className="border border-border rounded p-3 bg-background/50 cursor-pointer hover:border-primary/50 transition-colors"
                                    onClick={() => setSelectedExerciseId(ex.exercise._id)}
                                >
                                    <div className="font-semibold">{ex.exercise.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        Latest: {ex.latestWeight} lbs • {ex.totalSessions} sessions
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default ProgressPage;
