"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/Page";
import { PageHeader } from "@/components/layout/PageHeader";
import { TrendingUpIcon, TargetIcon, CalendarIcon, ActivityIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ProgressPage = () => {
    const { user } = useUser();
    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const activeGoal = useQuery(
        api.goals.getActiveGoal,
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
        if (!activeGoal) return null;

        const goalStartDate = new Date(activeGoal._creationTime);
        const now = new Date();
        const daysElapsed = Math.floor((now.getTime() - goalStartDate.getTime()) / (1000 * 60 * 60 * 24));
        const weeksElapsed = Math.floor(daysElapsed / 7);

        return {
            goal: activeGoal.category.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "No specific goal",
            primaryFocus: activeGoal.target?.exercise || activeGoal.target?.movement || "General fitness",
            weeksElapsed,
            daysElapsed,
            targetValue: activeGoal.value,
            targetUnit: activeGoal.unit,
        };
    }, [activeGoal]);

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
            <Page>
                <div className="flex items-center justify-center py-12">
                    <div className="text-center text-muted-foreground">Loading...</div>
                </div>
            </Page>
        );
    }

    if (!activeGoal) {
        return (
            <Page>
                <Card className="max-w-2xl mx-auto">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <h2 className="text-2xl font-semibold">No Active Goal</h2>
                            <p className="text-muted-foreground">Create a goal to track progress.</p>
                            <Button asChild className="mt-4">
                                <Link href="/generate-program">Create Goal</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </Page>
        );
    }

    return (
        <Page>
            <div className="max-w-6xl mx-auto space-y-8">
                <PageHeader
                    title="Progress Tracking"
                    description="Monitor your strength gains and goal progress"
                />

                {/* Goal Progress */}
                {goalProgress && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TargetIcon className="h-5 w-5 text-primary" />
                                Goal Progress
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="text-sm font-medium text-muted-foreground mb-1">Goal Category</div>
                                <div className="font-semibold text-lg capitalize">{goalProgress.goal}</div>
                            </div>
                            {goalProgress.primaryFocus && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Primary Focus</div>
                                    <div className="font-medium">{goalProgress.primaryFocus}</div>
                                </div>
                            )}
                            {goalProgress.targetValue && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Target</div>
                                    <div className="font-medium">{goalProgress.targetValue} {goalProgress.targetUnit || ""}</div>
                                </div>
                            )}
                            <div>
                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-muted-foreground">Time Active</span>
                                    <span className="font-semibold">
                                        {goalProgress.weeksElapsed} weeks ({goalProgress.daysElapsed} days)
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Body Part Strength Visualization */}
                {bodyPartStrength && bodyPartStrength.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ActivityIcon className="h-5 w-5 text-primary" />
                                Body Part Strength
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {bodyPartStrength.map((bp) => {
                                    const strengthPercent = (bp.totalVolume / maxBodyPartVolume) * 100;
                                    return (
                                        <div key={bp.bodyPart}>
                                            <div className="flex items-center justify-between text-sm mb-2">
                                                <span className="font-medium capitalize">{bp.bodyPart}</span>
                                                <span className="text-muted-foreground text-xs">
                                                    {bp.sessions} sessions • {bp.exerciseCount} exercises
                                                </span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                                                <div
                                                    className="bg-primary h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${strengthPercent}%` }}
                                                />
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1.5">
                                                {Math.round(bp.totalVolume).toLocaleString()} lbs total volume
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Exercise Progress Charts */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUpIcon className="h-5 w-5 text-primary" />
                            Exercise Progress
                        </CardTitle>
                    </CardHeader>
                    <CardContent>

                        {/* Exercise Selector */}
                        {topExercises.length > 0 && (
                            <div className="mb-6">
                                <div className="text-sm font-medium text-muted-foreground mb-3">Select an exercise to view progress:</div>
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
                                        <div className="text-sm font-medium text-muted-foreground mb-3">Max Weight Over Time</div>
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
                                        <div className="text-sm font-medium text-muted-foreground mb-3">Total Volume Per Session</div>
                                        <div className="space-y-2">
                                            {selectedExerciseProgress.map((point, idx) => {
                                                const maxVolume = Math.max(...selectedExerciseProgress.map((p) => p.totalVolume));
                                                const volumePercent = maxVolume > 0 ? (point.totalVolume / maxVolume) * 100 : 0;
                                                return (
                                                    <div key={idx} className="flex items-center gap-3">
                                                        <div className="w-24 text-xs text-muted-foreground">
                                                            {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                        </div>
                                                        <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                                                            <div
                                                                className="bg-primary h-full rounded-full transition-all duration-300"
                                                                style={{ width: `${volumePercent}%` }}
                                                            />
                                                        </div>
                                                        <div className="w-20 text-xs text-right font-medium">
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
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <CalendarIcon className="h-4 w-4 text-primary" />
                                            Future Projection
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
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
                                                    <span className="font-semibold text-green-600 dark:text-green-400">+{goalProjection.weeklyGain} lbs/week</span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {selectedExerciseId && (!selectedExerciseProgress || selectedExerciseProgress.length === 0) && (
                        <div className="text-center text-muted-foreground py-12">
                            No completed sets found for this exercise yet.
                        </div>
                    )}

                    {!selectedExerciseId && topExercises.length > 0 && (
                        <div className="text-center text-muted-foreground py-12">
                            Select an exercise above to view detailed progress.
                        </div>
                    )}

                    {topExercises.length === 0 && (
                        <div className="text-center text-muted-foreground py-12">
                            Complete some workouts to see your progress here.
                        </div>
                    )}
                    </CardContent>
                </Card>

                {/* Top Exercises Summary */}
                {topExercises.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Top Exercises</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {topExercises.slice(0, 6).map((ex) => (
                                    <div
                                        key={ex.exercise._id}
                                        className="rounded-lg border border-border p-3 bg-card cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
                                        onClick={() => setSelectedExerciseId(ex.exercise._id)}
                                    >
                                        <div className="font-semibold text-sm">{ex.exercise.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Latest: {ex.latestWeight} lbs • {ex.totalSessions} sessions
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </Page>
    );
};

export default ProgressPage;
