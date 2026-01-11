"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { CalendarIcon, DumbbellIcon, AppleIcon, Trash2Icon, CheckIcon, RefreshCwIcon, BanIcon } from "lucide-react";
import CornerElements from "@/components/CornerElements";
import { Button } from "@/components/ui/button";

const CalendarPage = () => {
    const { user } = useUser();

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const activePlan = useQuery(
        api.plans.getActivePlan,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const allPlans = useQuery(
        api.plans.getUserPlans,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );

    const [viewMonth, setViewMonth] = useState(new Date());
    const [editingSets, setEditingSets] = useState<Record<string, { weight: string; reps: string }>>({});

    const generateWorkouts = useAction(api.plans.generateWorkoutsFromStrategy);
    const setActivePlan = useMutation(api.plans.setActivePlan);
    const deletePlan = useMutation(api.plans.deletePlan);
    const updateExerciseSet = useMutation(api.plans.updateExerciseSet);
    const markMealComplete = useMutation(api.plans.markMealComplete);
    const generateNextWorkout = useAction(api.plans.generateNextWorkout);
    const regenerateMeal = useAction(api.plans.regenerateMeal);
    const regenerateExercise = useAction(api.plans.regenerateExercise);
    const blockItem = useMutation(api.plans.blockItem);

    const startDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
        .toISOString().split("T")[0];
    const endDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
        .toISOString().split("T")[0];

    const workouts = useQuery(
        api.plans.getWorkoutsByDateRange,
        convexUser?._id && activePlan?._id
            ? {
                  userId: convexUser._id,
                  startDate,
                  endDate,
              }
            : "skip"
    );

    // Debug: Get all workout sessions to see if any exist
    const allWorkoutSessions = useQuery(
        api.plans.getAllWorkoutSessions,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    // Debug logging
    if (workouts) {
        console.log("Workouts for current month:", {
            count: workouts.length,
            startDate,
            endDate,
            workouts: workouts.map(w => ({ date: w.date, exercises: w.exercises.length }))
        });
    }

    if (allWorkoutSessions) {
        console.log("All workout sessions for user:", {
            total: allWorkoutSessions.length,
            sessions: allWorkoutSessions,
            currentMonthRange: { startDate, endDate },
        });
    }

    const selectedWorkout = workouts?.find(
        (w) => w.date === selectedDate
    );

    const handleGenerateWorkouts = async () => {
        if (!convexUser?._id || !activePlan?._id) return;
        try {
            console.log("Generating workouts...", {
                planId: activePlan._id,
                userId: convexUser._id,
            });
            const result = await generateWorkouts({
                planId: activePlan._id,
                userId: convexUser._id,
            });
            console.log("Workout generation result:", result);
            // Don't show alert, let Convex auto-refresh the query
            // The workouts should appear automatically via reactive queries
        } catch (error) {
            console.error("Error generating workouts:", error);
            alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleSetActivePlan = async (planId: string) => {
        if (!convexUser?._id) return;
        try {
            await setActivePlan({
                planId: planId as any,
                userId: convexUser._id,
            });
        } catch (error) {
            console.error("Error setting active plan:", error);
            alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleDeletePlan = async (planId: string) => {
        if (!confirm("Are you sure you want to delete this plan? This will also delete all associated workouts.")) {
            return;
        }
        try {
            await deletePlan({ planId: planId as any });
        } catch (error) {
            console.error("Error deleting plan:", error);
            alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

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
        <section className="relative z-10 pt-12 pb-32 flex-grow container mx-auto px-4">
            <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                <CornerElements />
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">
                        <span className="text-primary">Training</span>{" "}
                        <span className="text-foreground">Calendar</span>
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap">
                        {allPlans && allPlans.length > 0 && (
                            <div className="flex items-center gap-2">
                                <select
                                    value={activePlan?._id || ""}
                                    onChange={(e) => {
                                        if (e.target.value && convexUser?._id) {
                                            handleSetActivePlan(e.target.value);
                                        }
                                    }}
                                    className="px-3 py-2 border border-border rounded bg-background text-foreground"
                                >
                                    {allPlans.map((plan) => (
                                        <option key={plan._id} value={plan._id}>
                                            {plan.name} {plan.isActive ? "✓" : ""}
                                        </option>
                                    ))}
                                </select>
                                {activePlan && (
                                    <>
                                        <Button
                                            onClick={() => handleSetActivePlan(activePlan._id)}
                                            variant="outline"
                                            size="sm"
                                            className="border-primary/50 text-primary hover:bg-primary/10"
                                            title="Activate this plan"
                                        >
                                            <CheckIcon className="h-4 w-4 mr-1" />
                                            Activate
                                        </Button>
                                        <Button
                                            onClick={() => handleDeletePlan(activePlan._id)}
                                            variant="outline"
                                            size="sm"
                                            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                                            title="Delete this plan"
                                        >
                                            <Trash2Icon className="h-4 w-4 mr-1" />
                                            Delete
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                        {activePlan && (
                            <Button
                                onClick={handleGenerateWorkouts}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                Generate Workouts
                            </Button>
                        )}
                    </div>
                </div>

                {!activePlan ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>No active plan found. Create a plan first.</p>
                    </div>
                ) : allWorkoutSessions && allWorkoutSessions.length > 0 && workouts && workouts.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground mb-2">
                            You have {allWorkoutSessions.length} workout{allWorkoutSessions.length !== 1 ? "s" : ""} scheduled, but none in this month.
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Workout dates: {allWorkoutSessions.slice(0, 5).map(s => s.date).join(", ")}
                            {allWorkoutSessions.length > 5 && "..."}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Try navigating to a different month to see your workouts.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <Button
                                    variant="outline"
                                    onClick={() => navigateMonth("prev")}
                                    className="border-primary/50 text-primary"
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
                                    className="border-primary/50 text-primary"
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

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() =>
                                                day && setSelectedDate(dateStr)
                                            }
                                            disabled={!day}
                                            className={`
                                                aspect-square p-2 rounded border transition-colors
                                                ${!day ? "border-transparent" : ""}
                                                ${isSelected
                                                    ? "bg-primary/20 border-primary text-primary"
                                                    : "border-border hover:border-primary/50"}
                                                ${isToday ? "ring-2 ring-primary/50" : ""}
                                                ${workoutExists ? "bg-green-500/10" : ""}
                                            `}
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
                        </div>

                        {selectedWorkout && (
                            <div className="mt-6 border border-border rounded-lg p-6 bg-background/50">
                                <div className="flex items-center gap-2 mb-4">
                                    <CalendarIcon className="h-5 w-5 text-primary" />
                                    <h3 className="text-lg font-bold">
                                        {new Date(selectedWorkout.date).toLocaleDateString(
                                            "en-US",
                                            {
                                                weekday: "long",
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            }
                                        )}
                                    </h3>
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                            Week {selectedWorkout.weekNumber} •{" "}
                                            {selectedWorkout.intensity}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
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
                                                            
                                                            // Check if all sets are completed, then generate next workout
                                                            const updatedSets = setsForExercise.map(s => 
                                                                s._id === set._id 
                                                                    ? { ...s, completed: true, actualWeight: weight, actualReps: reps }
                                                                    : s
                                                            );
                                                            const allDone = updatedSets.every(s => s.completed);
                                                            
                                                            if (allDone && convexUser?._id && activePlan?._id) {
                                                                // Generate next workout
                                                                try {
                                                                    await generateNextWorkout({
                                                                        planId: activePlan._id,
                                                                        userId: convexUser._id,
                                                                        completedSessionId: selectedWorkout._id,
                                                                    });
                                                                } catch (err) {
                                                                    console.error("Error generating next workout:", err);
                                                                }
                                                            }
                                                        } catch (error) {
                                                            console.error("Error updating set:", error);
                                                            alert("Failed to update set");
                                                        }
                                                    };

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`border border-border rounded p-3 bg-background/50 ${allCompleted ? "bg-green-500/10 border-green-500/50" : ""}`}
                                                        >
                                                            <div className="font-semibold mb-2 flex items-center justify-between">
                                                                <span>{exercise?.name || "Unknown Exercise"}</span>
                                                                <div className="flex items-center gap-2">
                                                                    {allCompleted && (
                                                                        <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded">
                                                                            ✓ Complete
                                                                        </span>
                                                                    )}
                                                                    {convexUser?._id && activePlan?._id && exercise?._id && setsForExercise.length > 0 && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={async () => {
                                                                                if (!confirm(`Replace "${exercise?.name}" with a new exercise of the same type?`)) return;
                                                                                try {
                                                                                    await regenerateExercise({
                                                                                        exerciseSetId: setsForExercise[0]._id,
                                                                                        userId: convexUser._id,
                                                                                        planId: activePlan._id,
                                                                                        sessionId: selectedWorkout._id,
                                                                                    });
                                                                                } catch (error) {
                                                                                    console.error("Error regenerating exercise:", error);
                                                                                    alert(error instanceof Error ? error.message : "Failed to regenerate exercise");
                                                                                }
                                                                            }}
                                                                            className="text-primary hover:bg-primary/10"
                                                                            title="Get a new exercise for this body part"
                                                                        >
                                                                            <RefreshCwIcon className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
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
                                                                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
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
                                                                                className={`flex items-center justify-between p-2 rounded ${set.completed ? "bg-green-500/10" : "bg-background/30"}`}
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
                                                                                                className="w-20 px-2 py-1 border border-border rounded bg-background text-sm"
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
                                                                                                className="w-20 px-2 py-1 border border-border rounded bg-background text-sm"
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
                                                                                        <div className="text-muted-foreground">
                                                                                            {set.actualWeight && set.actualReps ? (
                                                                                                <span className="text-green-500">
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
                                                                                        className={set.completed ? "border-green-500 text-green-500" : ""}
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
                                            <div className="flex items-center gap-2 mb-3">
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
                                                                className={`border border-border rounded p-3 bg-background/50 flex items-center justify-between ${dailyMeal.completed ? "bg-green-500/10 border-green-500/50" : ""}`}
                                                            >
                                                                <div className="flex-1">
                                                                    <div className="font-semibold mb-1 flex items-center gap-2">
                                                                        <span className="capitalize">{dailyMeal.mealType}</span>
                                                                        {dailyMeal.completed && (
                                                                            <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                                                                                ✓
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-sm text-muted-foreground">
                                                                        {meal?.name || "Unknown Meal"}
                                                                    </div>
                                                                    {meal?.foods && (
                                                                        <div className="text-xs text-muted-foreground mt-1">
                                                                            {meal.foods.join(", ")}
                                                                        </div>
                                                                    )}
                                                                    <div className="text-xs text-muted-foreground mt-1">
                                                                        {meal?.calories || 0} kcal
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {convexUser?._id && activePlan?._id && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await regenerateMeal({
                                                                                        dailyMealId: dailyMeal._id,
                                                                                        userId: convexUser._id,
                                                                                        planId: activePlan._id,
                                                                                    });
                                                                                } catch (error) {
                                                                                    console.error("Error regenerating meal:", error);
                                                                                    alert("Failed to regenerate meal");
                                                                                }
                                                                            }}
                                                                            className="text-primary hover:bg-primary/10"
                                                                            title="Get a new meal for this meal type"
                                                                        >
                                                                            <RefreshCwIcon className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
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
                                                                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                                                            title="Block this meal"
                                                                        >
                                                                            <BanIcon className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        variant={dailyMeal.completed ? "outline" : "default"}
                                                                        onClick={handleMealComplete}
                                                                        className={dailyMeal.completed ? "border-green-500 text-green-500" : ""}
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
                                </div>
                            </div>
                        )}

                        {!selectedWorkout && selectedDate && (
                            <div className="mt-6 border border-border rounded-lg p-6 bg-background/50 text-center text-muted-foreground">
                                <p>No workout scheduled for this date.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
};

export default CalendarPage;
