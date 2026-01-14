"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import CornerElements from "@/components/CornerElements";
import { DumbbellIcon, AppleIcon, CheckIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

const HomePage = () => {
    const { user } = useUser();
    const today = new Date().toISOString().split("T")[0];

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const todayWorkout = useQuery(
        api.workoutEditing.getTodayWorkout,
        convexUser?._id ? { userId: convexUser._id, date: today } : "skip"
    );

    const activePlan = useQuery(
        api.plans.getActivePlan,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const todayMealLogs = useQuery(
        api.mealLogs.getMealLogsByDate,
        convexUser?._id ? { userId: convexUser._id, date: today } : "skip"
    );

    const todayMeals = useQuery(
        api.plans.getWorkoutsByDateRange,
        convexUser?._id
            ? {
                  userId: convexUser._id,
                  startDate: today,
                  endDate: today,
              }
            : "skip"
    );

    const createMealLog = useMutation(api.mealLogs.createMealLog);
    const updateExerciseSet = useMutation(api.plans.updateExerciseSet);
    const generateNextWorkout = useAction(api.plans.generateNextWorkout);
    const generateTodayWorkout = useAction(api.plans.generateWorkoutsFromStrategy);

    const [newMealLog, setNewMealLog] = useState({
        name: "",
        calories: "",
        protein: "",
    });

    // Calculate nutrition stats
    const targetCalories = activePlan?.dietPlan?.dailyCalories || 0;
    const loggedCalories = todayMealLogs?.reduce((sum, log) => sum + log.calories, 0) || 0;
    const plannedMealCalories = todayMeals?.[0]?.meals?.reduce((sum: number, dm: any) => {
        return sum + (dm.meal?.calories || 0);
    }, 0) || 0;
    const totalCalories = loggedCalories + plannedMealCalories;

    // Calculate protein (heuristic: 0.7g per lb of body weight, or use logged)
    const estimatedWeight = 150; // Default, could come from user profile
    const proteinTarget = Math.round(estimatedWeight * 0.7);
    const loggedProtein = todayMealLogs?.reduce((sum, log) => sum + (log.protein || 0), 0) || 0;

    // Get workouts completed this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = new Date().toISOString().split("T")[0];

    const weekWorkouts = useQuery(
        api.plans.getWorkoutsByDateRange,
        convexUser?._id
            ? {
                  userId: convexUser._id,
                  startDate: weekStartStr,
                  endDate: weekEndStr,
              }
            : "skip"
    );

    const completedThisWeek = weekWorkouts?.filter((w) => {
        const allCompleted = w.exercises.every((e: any) => e.completed);
        return allCompleted;
    }).length || 0;

    const handleAddMealLog = async () => {
        if (!convexUser?._id || !newMealLog.name || !newMealLog.calories) return;

        try {
            await createMealLog({
                userId: convexUser._id,
                date: today,
                name: newMealLog.name,
                calories: parseInt(newMealLog.calories),
                protein: newMealLog.protein ? parseInt(newMealLog.protein) : undefined,
            });
            setNewMealLog({ name: "", calories: "", protein: "" });
        } catch (error) {
            alert("Failed to add meal log");
        }
    };

    const handleGenerateToday = async () => {
        if (!convexUser?._id || !activePlan?._id) return;
        try {
            await generateTodayWorkout({
                planId: activePlan._id,
                userId: convexUser._id,
            });
        } catch (error) {
            alert("Failed to generate workout");
        }
    };

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
                        <p className="text-muted-foreground mb-4">
                            Create a plan to get started with your daily workouts and meals.
                        </p>
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
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                    <CornerElements />
                    <h1 className="text-2xl font-bold mb-6">
                        <span className="text-primary">Today</span> - {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </h1>

                    {/* Quick Insights */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-background/50 p-4 rounded border border-border">
                            <div className="text-sm text-muted-foreground">Workouts This Week</div>
                            <div className="text-2xl font-bold text-primary">{completedThisWeek}</div>
                        </div>
                        <div className="bg-background/50 p-4 rounded border border-border">
                            <div className="text-sm text-muted-foreground">Calories</div>
                            <div className="text-2xl font-bold">
                                {totalCalories} / {targetCalories}
                            </div>
                        </div>
                        <div className="bg-background/50 p-4 rounded border border-border">
                            <div className="text-sm text-muted-foreground">Protein</div>
                            <div className="text-2xl font-bold">
                                {loggedProtein}g / {proteinTarget}g
                            </div>
                            {loggedProtein < proteinTarget * 0.7 && (
                                <div className="text-xs text-yellow-500 mt-1">Low protein warning</div>
                            )}
                        </div>
                    </div>

                    {/* Today's Workout */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <DumbbellIcon className="h-5 w-5 text-primary" />
                                Today's Workout
                            </h2>
                            {!todayWorkout && (
                                <Button onClick={handleGenerateToday} size="sm">
                                    Generate Today
                                </Button>
                            )}
                        </div>

                        {todayWorkout ? (
                            <div className="space-y-3">
                                {todayWorkout.exercises
                                    .filter((e: any, idx: number, arr: any[]) => 
                                        arr.findIndex((x: any) => x.exercise?._id === e.exercise?._id) === idx
                                    )
                                    .map((exerciseSet: any, idx: number) => {
                                        const exercise = exerciseSet.exercise;
                                        const setsForExercise = todayWorkout.exercises.filter(
                                            (e: any) => e.exercise?._id === exercise?._id
                                        );
                                        const allCompleted = setsForExercise.every((s: any) => s.completed);

                                        return (
                                            <div
                                                key={idx}
                                                className={`border border-border rounded p-3 bg-background/50 ${
                                                    allCompleted ? "bg-green-500/10 border-green-500/50" : ""
                                                }`}
                                            >
                                                <div className="font-semibold mb-2 flex items-center justify-between">
                                                    <span>{exercise?.name || "Unknown"}</span>
                                                    {allCompleted && (
                                                        <CheckIcon className="h-4 w-4 text-green-500" />
                                                    )}
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
                                                            {!set.completed && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={async () => {
                                                                        try {
                                                                            await updateExerciseSet({
                                                                                setId: set._id,
                                                                                actualWeight: set.plannedWeight,
                                                                                actualReps: set.plannedReps,
                                                                                completed: true,
                                                                            });
                                                                        } catch (error) {
                                                                            alert("Failed to complete set");
                                                                        }
                                                                    }}
                                                                >
                                                                    Complete
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                <Link href="/workouts">
                                    <Button variant="outline" className="w-full mt-4">
                                        View Full Workout
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground border border-border rounded">
                                <p>No workout scheduled for today.</p>
                                <p className="text-sm mt-2">Rest day or generate a workout above.</p>
                            </div>
                        )}
                    </div>

                    {/* Today's Nutrition */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <AppleIcon className="h-5 w-5 text-primary" />
                                Today's Nutrition
                            </h2>
                        </div>

                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-muted-foreground">Calories</span>
                                <span className="font-semibold">
                                    {totalCalories} / {targetCalories}
                                </span>
                            </div>
                            <div className="w-full bg-background/50 rounded-full h-2">
                                <div
                                    className="bg-primary h-2 rounded-full"
                                    style={{ width: `${Math.min(100, (totalCalories / targetCalories) * 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Quick Add Meal Log */}
                        <div className="border border-border rounded p-4 mb-4 bg-background/50">
                            <h3 className="font-semibold mb-3">Quick Log Meal</h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Meal name"
                                    value={newMealLog.name}
                                    onChange={(e) => setNewMealLog({ ...newMealLog, name: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-border rounded bg-background"
                                />
                                <input
                                    type="number"
                                    placeholder="Calories"
                                    value={newMealLog.calories}
                                    onChange={(e) => setNewMealLog({ ...newMealLog, calories: e.target.value })}
                                    className="w-24 px-3 py-2 border border-border rounded bg-background"
                                />
                                <input
                                    type="number"
                                    placeholder="Protein (g)"
                                    value={newMealLog.protein}
                                    onChange={(e) => setNewMealLog({ ...newMealLog, protein: e.target.value })}
                                    className="w-24 px-3 py-2 border border-border rounded bg-background"
                                />
                                <Button onClick={handleAddMealLog} size="sm">
                                    <PlusIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Today's Logs */}
                        {todayMealLogs && todayMealLogs.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">Logged Meals</h3>
                                {todayMealLogs.map((log) => (
                                    <div
                                        key={log._id}
                                        className="flex items-center justify-between p-2 border border-border rounded bg-background/50"
                                    >
                                        <div>
                                            <div className="font-medium">{log.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {log.calories} cal{log.protein ? ` • ${log.protein}g protein` : ""}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <Link href="/meals">
                            <Button variant="outline" className="w-full mt-4">
                                View Full Nutrition
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HomePage;
