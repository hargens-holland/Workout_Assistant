"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import CornerElements from "@/components/CornerElements";
import { DumbbellIcon, CalendarIcon, HistoryIcon, RefreshCwIcon, BanIcon, MinusIcon } from "lucide-react";
import Link from "next/link";

const WorkoutsPage = () => {
    const { user } = useUser();
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const activePlan = useQuery(
        api.plans.getActivePlan,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const upcomingWorkouts = useQuery(
        api.workoutEditing.getUpcomingWorkouts,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const workoutHistory = useQuery(
        api.workoutEditing.getWorkoutHistory,
        convexUser?._id ? { userId: convexUser._id } : "skip"
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
                        <p className="text-muted-foreground mb-4">Create a plan to view workouts.</p>
                        <Button asChild>
                            <Link href="/generate-program">Create Plan</Link>
                        </Button>
                    </div>
                </div>
            </section>
        );
    }

    const trainingStrategy = activePlan.trainingStrategy as any;

    return (
        <section className="relative z-10 pt-12 pb-32 flex-grow container mx-auto px-4">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Current Focus */}
                <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                    <CornerElements />
                    <h2 className="text-xl font-bold mb-4">Current Focus</h2>
                    {trainingStrategy ? (
                        <div className="space-y-2">
                            <div>
                                <span className="text-sm text-muted-foreground">Goal: </span>
                                <span className="font-semibold">{trainingStrategy.goal_type}</span>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground">Primary Focus: </span>
                                <span className="font-semibold">{trainingStrategy.primary_focus}</span>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground">Priorities: </span>
                                <span>{trainingStrategy.training_priorities?.join(", ") || "None"}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No training strategy defined.</p>
                    )}
                </div>

                {/* Today Link */}
                <div className="relative backdrop-blur-sm border border-border p-4 rounded-lg">
                    <Link href="/home" className="flex items-center gap-2 text-primary hover:underline">
                        <CalendarIcon className="h-4 w-4" />
                        <span>View Today's Workout</span>
                    </Link>
                </div>

                {/* Upcoming Workouts */}
                <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                    <CornerElements />
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        Upcoming (Next 7 Days)
                    </h2>
                    {upcomingWorkouts && upcomingWorkouts.length > 0 ? (
                        <div className="space-y-2">
                            {upcomingWorkouts.map((session: any) => (
                                <button
                                    key={session._id}
                                    onClick={() => setSelectedSessionId(session._id)}
                                    className={`w-full text-left p-4 border border-border rounded hover:border-primary/50 transition-colors ${
                                        selectedSessionId === session._id ? "bg-primary/10 border-primary" : "bg-background/50"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold">
                                                {new Date(session.date).toLocaleDateString("en-US", {
                                                    weekday: "long",
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {session.dayOfWeek} • {session.intensity}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No upcoming workouts scheduled.</p>
                    )}
                </div>

                {/* History */}
                <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                    <CornerElements />
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <HistoryIcon className="h-5 w-5 text-primary" />
                        History (Last 14 Days)
                    </h2>
                    {workoutHistory && workoutHistory.length > 0 ? (
                        <div className="space-y-2">
                            {workoutHistory.map((session: any) => (
                                <div
                                    key={session._id}
                                    className="p-4 border border-border rounded bg-background/50"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold">
                                                {new Date(session.date).toLocaleDateString("en-US", {
                                                    weekday: "long",
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {session.dayOfWeek} • {session.intensity}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold">
                                                {session.completedSets} / {session.totalSets} sets
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {Math.round(session.completionRate * 100)}% complete
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No workout history.</p>
                    )}
                </div>

                {/* Session Detail Modal/Drawer */}
                {selectedWorkout && (
                    <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                        <CornerElements />
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">
                                {new Date(selectedWorkout.date).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedSessionId(null)}
                            >
                                Close
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-2">
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
                                            className="border border-border rounded p-4 bg-background/50"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-semibold">{exercise?.name || "Unknown"}</h4>
                                                <div className="flex gap-2">
                                                    {convexUser?._id && activePlan?._id && exercise?._id && (
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
                                                                            planId: activePlan._id,
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
                                                                className="text-red-500 hover:text-red-600"
                                                            >
                                                                <BanIcon className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                {setsForExercise.map((set: any, setIdx: number) => (
                                                    <div
                                                        key={setIdx}
                                                        className={`flex items-center justify-between ${
                                                            set.completed ? "text-green-500" : ""
                                                        }`}
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
                    </div>
                )}
            </div>
        </section>
    );
};

export default WorkoutsPage;
