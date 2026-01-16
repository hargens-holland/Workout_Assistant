"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/Page";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { DumbbellIcon, CalendarIcon, HistoryIcon, RefreshCwIcon, BanIcon, MinusIcon, ActivityIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import BodyWorkoutTracker from "@/components/BodyWorkoutTracker";

const WorkoutsPage = () => {
    const { user } = useUser();
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const activeGoal = useQuery(
        api.goals.getActiveGoal,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const upcomingWorkouts = useQuery(
        api.workoutEditing.getUpcomingWorkouts,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const workoutHistory = useQuery(
        api.plans.getWorkoutHistory,
        convexUser?._id ? { userId: convexUser._id, limit: 14 } : "skip"
    );

    const selectedWorkout = useQuery(
        api.plans.getWorkoutsByDateRange,
        selectedSessionId && convexUser?._id
            ? {
                  userId: convexUser._id,
                  startDate: new Date().toISOString().split("T")[0],
                  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              }
            : "skip"
    )?.find((w: any) => w._id === selectedSessionId);

    const reduceVolume = useMutation(api.workoutEditing.reduceWorkoutVolume);
    const regenerateExercise = useAction(api.plans.regenerateExercise);
    const blockItem = useMutation(api.plans.blockItem);

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
                            <p className="text-muted-foreground">Create a goal to view workouts.</p>
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
                    title="Workouts"
                    description="Manage your training schedule and exercise history"
                />

                {/* Body Workout Tracker */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <ActivityIcon className="h-5 w-5 text-primary" />
                            </div>
                            Body Workout Tracker
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {convexUser?._id && (
                            <BodyWorkoutTracker userId={convexUser._id} />
                        )}
                    </CardContent>
                </Card>

                {/* Current Focus */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Current Focus</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {activeGoal ? (
                            <div className="space-y-4">
                                <div>
                                    <span className="text-sm font-medium text-muted-foreground">Goal Category: </span>
                                    <span className="font-semibold text-base capitalize">{activeGoal.category.replace("_", " ")}</span>
                                </div>
                                {activeGoal.direction && (
                                    <div>
                                        <span className="text-sm font-medium text-muted-foreground">Direction: </span>
                                        <span className="font-semibold text-base capitalize">{activeGoal.direction}</span>
                                    </div>
                                )}
                                {activeGoal.target?.exercise && (
                                    <div>
                                        <span className="text-sm font-medium text-muted-foreground">Target Exercise: </span>
                                        <span className="font-semibold text-base">{activeGoal.target.exercise}</span>
                                    </div>
                                )}
                                {activeGoal.value && (
                                    <div>
                                        <span className="text-sm font-medium text-muted-foreground">Target: </span>
                                        <span className="font-semibold text-base">{activeGoal.value} {activeGoal.unit || ""}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No active goal defined.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Today Link */}
                <Card>
                    <CardContent className="pt-6">
                        <Link href="/home" className="flex items-center gap-3 text-primary hover:text-primary/80 transition-all duration-200 group">
                            <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                                <CalendarIcon className="h-4 w-4" />
                            </div>
                            <span className="font-medium">View Today's Workout</span>
                        </Link>
                    </CardContent>
                </Card>

                {/* Upcoming Workouts */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                            </div>
                            Upcoming (Next 7 Days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {upcomingWorkouts && upcomingWorkouts.length > 0 ? (
                            <div className="space-y-3">
                                {upcomingWorkouts.map((session: any) => (
                                    <button
                                        key={session._id}
                                        onClick={() => setSelectedSessionId(session._id)}
                                        className={cn(
                                            "w-full text-left p-5 rounded-xl transition-all duration-200",
                                            selectedSessionId === session._id
                                                ? "bg-primary/10 shadow-soft-lg scale-[1.02]"
                                                : "bg-card/50 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-semibold text-base">
                                                    {new Date(session.date).toLocaleDateString("en-US", {
                                                        weekday: "long",
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    {session.dayOfWeek} • {session.intensity}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-12">No upcoming workouts scheduled.</p>
                        )}
                    </CardContent>
                </Card>

                {/* History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <HistoryIcon className="h-5 w-5 text-primary" />
                            </div>
                            History (Last 14 Days)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {workoutHistory && workoutHistory.length > 0 ? (
                            <div className="space-y-3">
                                {workoutHistory.map((session: any) => (
                                    <div
                                        key={session._id}
                                        className="p-5 rounded-xl bg-card/50 shadow-soft hover:shadow-soft-lg transition-all duration-200"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-semibold text-base">
                                                    {new Date(session.date).toLocaleDateString("en-US", {
                                                        weekday: "long",
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    {session.dayOfWeek} • {session.intensity}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold">
                                                    {session.completedSets} / {session.totalSets} sets
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {Math.round(session.completionRate * 100)}% complete
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-12">No workout history.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Session Detail Modal/Drawer */}
                {selectedWorkout && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>
                                    {new Date(selectedWorkout.date).toLocaleDateString("en-US", {
                                        weekday: "long",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedSessionId(null)}
                                >
                                    Close
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex gap-3 flex-wrap">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                        if (!selectedWorkout._id) return;
                                        try {
                                            await reduceVolume({
                                                sessionId: selectedWorkout._id,
                                                mode: "remove_set",
                                            });
                                            alert("Removed 1 set from each exercise");
                                        } catch (error) {
                                            alert("Failed to reduce volume");
                                        }
                                    }}
                                >
                                    <MinusIcon className="h-4 w-4 mr-1" />
                                    Make Easier (Remove Set)
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                        if (!selectedWorkout._id) return;
                                        try {
                                            await reduceVolume({
                                                sessionId: selectedWorkout._id,
                                                mode: "remove_exercise",
                                            });
                                            alert("Removed 1 exercise");
                                        } catch (error) {
                                            alert("Failed to reduce volume");
                                        }
                                    }}
                                >
                                    <MinusIcon className="h-4 w-4 mr-1" />
                                    Make Shorter (Remove Exercise)
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {selectedWorkout.exercises
                                    .filter((e: any, idx: number, arr: any[]) =>
                                        arr.findIndex((x: any) => x.exercise?._id === e.exercise?._id) === idx
                                    )
                                    .map((exerciseSet: any, idx: number) => {
                                        const exercise = exerciseSet.exercise;
                                        const setsForExercise = selectedWorkout.exercises.filter(
                                            (e: any) => e.exercise?._id === exercise?._id
                                        );

                                        return (
                                            <div
                                                key={idx}
                                                className="rounded-xl p-5 bg-card/50 shadow-soft hover:shadow-soft-lg transition-all duration-200"
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="font-semibold text-base">{exercise?.name || "Unknown"}</h4>
                                                    <div className="flex gap-2">
                                                        {convexUser?._id && exercise?._id && (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={async () => {
                                                                        if (!confirm(`Replace "${exercise?.name}" with a new exercise?`))
                                                                            return;
                                                                        try {
                                                                            await regenerateExercise({
                                                                                exerciseSetId: setsForExercise[0]._id,
                                                                                userId: convexUser._id,
                                                                                sessionId: selectedWorkout._id,
                                                                            });
                                                                        } catch (error) {
                                                                            alert("Failed to regenerate exercise");
                                                                        }
                                                                    }}
                                                                    title="Get a new exercise for this body part"
                                                                >
                                                                    <RefreshCwIcon className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={async () => {
                                                                        if (!confirm(`Block "${exercise?.name}"?`)) return;
                                                                        try {
                                                                            await blockItem({
                                                                                userId: convexUser._id,
                                                                                itemType: "exercise",
                                                                                itemId: exercise._id,
                                                                                itemName: exercise.name,
                                                                            });
                                                                            alert(`${exercise.name} has been blocked`);
                                                                        } catch (error) {
                                                                            alert("Failed to block exercise");
                                                                        }
                                                                    }}
                                                                    title="Block this exercise"
                                                                    className="text-destructive hover:text-destructive/80"
                                                                >
                                                                    <BanIcon className="h-3 w-3" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-2 text-sm">
                                                    {setsForExercise.map((set: any, setIdx: number) => (
                                                        <div
                                                            key={setIdx}
                                                            className={cn(
                                                                "flex items-center justify-between py-2",
                                                                set.completed && "text-green-600 dark:text-green-400"
                                                            )}
                                                        >
                                                            <span>
                                                                Set {set.setNumber}: {set.actualWeight || set.plannedWeight} lbs × {set.actualReps || set.plannedReps} reps
                                                            </span>
                                                            {set.completed && (
                                                                <span className="text-xs">✓</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </Page>
    );
};

export default WorkoutsPage;
