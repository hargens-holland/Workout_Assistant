"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { CalendarIcon, DumbbellIcon, AppleIcon, Trash2Icon, CheckIcon, RefreshCwIcon, BanIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/Page";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CalendarPage = () => {
    const { user } = useUser();

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const activeGoal = useQuery(
        api.goals.getActiveGoal,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );

    const [viewMonth, setViewMonth] = useState(new Date());
    const [editingSets, setEditingSets] = useState<Record<string, { weight: string; reps: string }>>({});

    const updateExerciseSet = useMutation(api.plans.updateExerciseSet);
    const markMealComplete = useMutation(api.plans.markMealComplete);
    const regenerateMeal = useAction(api.plans.regenerateMeal);
    const regenerateExercise = useAction(api.plans.regenerateExercise);
    const blockItem = useMutation(api.plans.blockItem);

    const startDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
        .toISOString().split("T")[0];
    const endDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
        .toISOString().split("T")[0];

    const workouts = useQuery(
        api.plans.getWorkoutsByDateRange,
        convexUser?._id
            ? {
                  userId: convexUser._id,
                  startDate,
                  endDate,
              }
            : "skip"
    );


    const selectedWorkout = workouts?.find(
        (w) => w.date === selectedDate
    );


    const getDaysInMonth = () => {
        const year = viewMonth.getFullYear();
        const month = viewMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }
        return days;
    };

    const getDateString = (day: number | null) => {
        if (day === null) return "";
        const year = viewMonth.getFullYear();
        const month = viewMonth.getMonth();
        return new Date(year, month, day).toISOString().split("T")[0];
    };

    const hasWorkout = (dateStr: string) => {
        return workouts?.some((w) => w.date === dateStr) || false;
    };

    const navigateMonth = (direction: "prev" | "next") => {
        setViewMonth((prev) => {
            const newDate = new Date(prev);
            if (direction === "prev") {
                newDate.setMonth(prev.getMonth() - 1);
            } else {
                newDate.setMonth(prev.getMonth() + 1);
            }
            return newDate;
        });
    };

    const days = getDaysInMonth();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
        <Page>
            <div className="max-w-6xl mx-auto space-y-8">
                <PageHeader
                    title="Workout History"
                    description="View your past workouts and meals"
                />
                {!activeGoal ? (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center py-12 text-muted-foreground">
                                <p>No active goal found. Create a goal first to start tracking workouts.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : workouts && workouts.length === 0 ? (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center py-12 text-muted-foreground">
                                <p>No workouts found for this month.</p>
                                <p className="text-sm mt-2">Navigate to different months to view your workout history.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-6">
                                    <Button
                                        variant="outline"
                                        onClick={() => navigateMonth("prev")}
                                    >
                                        ← Prev
                                    </Button>
                                    <h2 className="text-xl font-semibold">
                                        {viewMonth.toLocaleDateString("en-US", {
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </h2>
                                    <Button
                                        variant="outline"
                                        onClick={() => navigateMonth("next")}
                                    >
                                        Next →
                                    </Button>
                                </div>

                                <div className="grid grid-cols-7 gap-2">
                                    {dayNames.map((day) => (
                                        <div
                                            key={day}
                                            className="text-center text-sm font-semibold text-muted-foreground py-2"
                                        >
                                            {day}
                                        </div>
                                    ))}
                                    {days.map((day, idx) => {
                                        const dateStr = getDateString(day);
                                        const isSelected = dateStr === selectedDate;
                                        const workoutExists = hasWorkout(dateStr);
                                        const isToday =
                                            dateStr ===
                                            new Date().toISOString().split("T")[0];
                                        const isFuture = dateStr > new Date().toISOString().split("T")[0];

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() =>
                                                    day && !isFuture && setSelectedDate(dateStr)
                                                }
                                                disabled={!day || isFuture}
                                                className={cn(
                                                    "aspect-square p-2 rounded-lg border transition-colors",
                                                    !day && "border-transparent",
                                                    isFuture && "opacity-50 cursor-not-allowed",
                                                    isSelected
                                                        ? "bg-primary/10 border-primary text-primary"
                                                        : "border-border hover:border-primary/50 hover:bg-accent/50",
                                                    isToday && "ring-2 ring-primary/30",
                                                    workoutExists && "bg-green-50 dark:bg-green-950/20"
                                                )}
                                            >
                                                {day && (
                                                    <>
                                                        <div className="text-sm font-semibold">
                                                            {day}
                                                        </div>
                                                        {workoutExists && (
                                                            <div className="w-2 h-2 bg-primary rounded-full mx-auto mt-1" />
                                                        )}
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {selectedWorkout && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <CalendarIcon className="h-5 w-5 text-primary" />
                                            {new Date(selectedWorkout.date).toLocaleDateString(
                                                "en-US",
                                                {
                                                    weekday: "long",
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                }
                                            )}
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">

                                    <div>
                                        <span className="text-sm text-muted-foreground">
                                            {selectedWorkout.intensity}
                                        </span>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <DumbbellIcon className="h-4 w-4 text-primary" />
                                            <h4 className="font-semibold">Workout</h4>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedWorkout.exercises
                                                .filter(
                                                    (e, idx, arr) =>
                                                        arr.findIndex(
                                                            (x) =>
                                                                x.exercise?._id ===
                                                                e.exercise?._id
                                                        ) === idx
                                                )
                                                .map((exerciseSet, idx) => {
                                                    const exercise = exerciseSet.exercise;
                                                    const setsForExercise =
                                                        selectedWorkout.exercises.filter(
                                                            (e) =>
                                                                e.exercise?._id ===
                                                                exercise?._id
                                                        );

                                                    const allCompleted = setsForExercise.every(s => s.completed);

                                                    const handleSetComplete = async (set: any) => {
                                                        const setKey = set._id;
                                                        const isEditing = editingSets[setKey] !== undefined;
                                                        
                                                        if (!isEditing) {
                                                            setEditingSets({
                                                                ...editingSets,
                                                                [setKey]: {
                                                                    weight: set.actualWeight?.toString() || set.plannedWeight.toString(),
                                                                    reps: set.actualReps?.toString() || set.plannedReps.toString(),
                                                                },
                                                            });
                                                            return;
                                                        }

                                                        const editData = editingSets[setKey];
                                                        const weight = parseFloat(editData.weight);
                                                        const reps = parseInt(editData.reps);
                                                        
                                                        if (isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) {
                                                            alert("Please enter valid weight and reps");
                                                            return;
                                                        }

                                                        try {
                                                            await updateExerciseSet({
                                                                setId: set._id,
                                                                actualWeight: weight,
                                                                actualReps: reps,
                                                                completed: true,
                                                            });
                                                            
                                                            const newEditingSets = { ...editingSets };
                                                            delete newEditingSets[setKey];
                                                            setEditingSets(newEditingSets);
                                                            
                                                            // Workout completion - no automatic next workout generation
                                                        } catch (error) {
                                                            console.error("Error updating set:", error);
                                                            alert("Failed to update set");
                                                        }
                                                    };

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={cn(
                                                                "rounded-lg border p-4",
                                                                allCompleted 
                                                                    ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" 
                                                                    : "bg-card border-border"
                                                            )}
                                                        >
                                                            <div className="font-semibold mb-3 flex items-center justify-between">
                                                                <span>{exercise?.name || "Unknown Exercise"}</span>
                                                                <div className="flex items-center gap-2">
                                                                    {allCompleted && (
                                                                        <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded">
                                                                            ✓ Complete
                                                                        </span>
                                                                    )}
                                                                    {/* Exercise regeneration only available for today's workout via chat */}
                                                                    {convexUser?._id && exercise?._id && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={async () => {
                                                                                if (!confirm(`Block "${exercise?.name}"? You won't see this exercise in future workouts.`)) return;
                                                                                try {
                                                                                    await blockItem({
                                                                                        userId: convexUser._id,
                                                                                        itemType: "exercise",
                                                                                        itemId: exercise._id,
                                                                                        itemName: exercise.name,
                                                                                    });
                                                                                    alert(`${exercise.name} has been blocked`);
                                                                                } catch (error) {
                                                                                    console.error("Error blocking exercise:", error);
                                                                                    alert("Failed to block exercise");
                                                                                }
                                                                            }}
                                                                            className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                                                            title="Block this exercise"
                                                                        >
                                                                            <BanIcon className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2 text-sm">
                                                                {setsForExercise.map(
                                                                    (set, setIdx) => {
                                                                        const setKey = set._id;
                                                                        const isEditing = editingSets[setKey] !== undefined;
                                                                        const editData = editingSets[setKey];
                                                                        return (
                                                                            <div
                                                                                key={setIdx}
                                                                                className={cn(
                                                                                    "flex items-center justify-between p-2 rounded",
                                                                                    set.completed 
                                                                                        ? "bg-green-50 dark:bg-green-950/20" 
                                                                                        : "bg-muted/30"
                                                                                )}
                                                                            >
                                                                                <div className="flex-1">
                                                                                    <div className="font-medium">
                                                                                        Set {set.setNumber}:
                                                                                    </div>
                                                                                    {isEditing ? (
                                                                                        <div className="flex gap-2 mt-1">
                                                                                            <input
                                                                                                type="number"
                                                                                                value={editData.weight}
                                                                                                onChange={(e) => setEditingSets({
                                                                                                    ...editingSets,
                                                                                                    [setKey]: { ...editData, weight: e.target.value },
                                                                                                })}
                                                                                                placeholder="Weight"
                                                                                                className="w-20 px-2 py-1 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                                            />
                                                                                            <span className="text-muted-foreground">lbs ×</span>
                                                                                            <input
                                                                                                type="number"
                                                                                                value={editData.reps}
                                                                                                onChange={(e) => setEditingSets({
                                                                                                    ...editingSets,
                                                                                                    [setKey]: { ...editData, reps: e.target.value },
                                                                                                })}
                                                                                                placeholder="Reps"
                                                                                                className="w-20 px-2 py-1 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                                            />
                                                                                            <Button
                                                                                                size="sm"
                                                                                                onClick={() => handleSetComplete(set)}
                                                                                                className="bg-primary text-primary-foreground"
                                                                                            >
                                                                                                Save
                                                                                            </Button>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="outline"
                                                                                                onClick={() => {
                                                                                                    const newEditingSets = { ...editingSets };
                                                                                                    delete newEditingSets[setKey];
                                                                                                    setEditingSets(newEditingSets);
                                                                                                }}
                                                                                            >
                                                                                                Cancel
                                                                                            </Button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className={cn(
                                                                                            "text-muted-foreground",
                                                                                            set.actualWeight && set.actualReps && "text-green-600 dark:text-green-400"
                                                                                        )}>
                                                                                            {set.actualWeight && set.actualReps ? (
                                                                                                <span>
                                                                                                    {set.actualWeight} lbs × {set.actualReps} reps
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span>
                                                                                                    {set.plannedWeight} lbs × {set.plannedReps} reps
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                {!isEditing && (
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant={set.completed ? "outline" : "default"}
                                                                                        onClick={() => handleSetComplete(set)}
                                                                                        className={set.completed ? "border-green-600 text-green-600 dark:border-green-400 dark:text-green-400" : ""}
                                                                                    >
                                                                                        {set.completed ? "✓" : "Complete"}
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    {selectedWorkout.meals && selectedWorkout.meals.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-4">
                                                <AppleIcon className="h-4 w-4 text-primary" />
                                                <h4 className="font-semibold">Meals</h4>
                                            </div>
                                            <div className="space-y-2">
                                                {selectedWorkout.meals.map(
                                                    (dailyMeal: any, mealIdx: number) => {
                                                        const meal = dailyMeal.meal;
                                                        const handleMealComplete = async () => {
                                                            try {
                                                                await markMealComplete({
                                                                    dailyMealId: dailyMeal._id,
                                                                    completed: !dailyMeal.completed,
                                                                });
                                                            } catch (error) {
                                                                console.error("Error marking meal complete:", error);
                                                                alert("Failed to update meal");
                                                            }
                                                        };

                                                        return (
                                                            <div
                                                                key={mealIdx}
                                                                className={cn(
                                                                    "rounded-lg border p-3 flex items-center justify-between",
                                                                    dailyMeal.completed 
                                                                        ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" 
                                                                        : "bg-card border-border"
                                                                )}
                                                            >
                                                                <div className="flex-1">
                                                                    <div className="font-semibold mb-1 flex items-center gap-2 text-sm">
                                                                        <span className="capitalize">{dailyMeal.mealType}</span>
                                                                        {dailyMeal.completed && (
                                                                            <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">
                                                                                ✓
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-sm text-muted-foreground">
                                                                        {meal?.name || "Unknown Meal"}
                                                                    </div>
                                                                    {meal?.foods && (
                                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                                            {meal.foods.join(", ")}
                                                                        </div>
                                                                    )}
                                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                                        {meal?.calories || 0} kcal
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {/* Meal regeneration only available for today's workout via chat */}
                                                                    {convexUser?._id && meal?._id && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={async () => {
                                                                                if (!confirm(`Block "${meal?.name}"? You won't see this meal in future suggestions.`)) return;
                                                                                try {
                                                                                    await blockItem({
                                                                                        userId: convexUser._id,
                                                                                        itemType: "meal",
                                                                                        itemId: meal._id,
                                                                                        itemName: meal.name,
                                                                                    });
                                                                                    alert(`${meal.name} has been blocked`);
                                                                                } catch (error) {
                                                                                    console.error("Error blocking meal:", error);
                                                                                    alert("Failed to block meal");
                                                                                }
                                                                            }}
                                                                            className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                                                            title="Block this meal"
                                                                        >
                                                                            <BanIcon className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        variant={dailyMeal.completed ? "outline" : "default"}
                                                                        onClick={handleMealComplete}
                                                                        className={dailyMeal.completed ? "border-green-600 text-green-600 dark:border-green-400 dark:text-green-400" : ""}
                                                                    >
                                                                        {dailyMeal.completed ? "✓" : "Complete"}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {!selectedWorkout && selectedDate && (
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-center py-12 text-muted-foreground">
                                        <p>No workout scheduled for this date.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </Page>
    );
};

export default CalendarPage;
