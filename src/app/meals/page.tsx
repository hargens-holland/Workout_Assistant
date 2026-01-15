"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/Page";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { AppleIcon, PlusIcon, RefreshCwIcon, BanIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const MealsPage = () => {
    const { user } = useUser();
    const today = new Date().toISOString().split("T")[0];

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const activePlan = useQuery(
        api.plans.getActivePlan,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const todayMealLogs = useQuery(
        api.mealLogs.getMealLogsByDate,
        convexUser?._id ? { userId: convexUser._id, date: today } : "skip"
    );

    const todayWorkout = useQuery(
        api.plans.getWorkoutsByDateRange,
        convexUser?._id
            ? {
                userId: convexUser._id,
                startDate: today,
                endDate: today,
            }
            : "skip"
    );

    // Get week of meal logs for trend
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = new Date().toISOString().split("T")[0];

    const weekMealLogs = useQuery(
        api.mealLogs.getMealLogsByDateRange,
        convexUser?._id
            ? {
                userId: convexUser._id,
                startDate: weekStartStr,
                endDate: weekEndStr,
            }
            : "skip"
    );

    // Get suggested meals
    const allMeals = useQuery(api.plans.getAllMeals, {});

    const createMealLog = useMutation(api.mealLogs.createMealLog);
    const updateMealLog = useMutation(api.mealLogs.updateMealLog);
    const deleteMealLog = useMutation(api.mealLogs.deleteMealLog);
    const regenerateMeal = useAction(api.plans.regenerateMeal);
    const blockItem = useMutation(api.plans.blockItem);
    const createDailyMeal = useMutation(api.plans.createDailyMeal);

    const [newMealLog, setNewMealLog] = useState({
        name: "",
        calories: "",
        protein: "",
        mealType: "",
    });

    // Calculate nutrition stats
    const targetCalories = activePlan?.dietPlan?.dailyCalories || 0;
    const loggedCalories = todayMealLogs?.reduce((sum, log) => sum + log.calories, 0) || 0;
    const plannedMealCalories = todayWorkout?.[0]?.meals?.reduce((sum: number, dm: any) => {
        return sum + (dm.meal?.calories || 0);
    }, 0) || 0;
    const totalCalories = loggedCalories + plannedMealCalories;

    const estimatedWeight = 150;
    const proteinTarget = Math.round(estimatedWeight * 0.7);
    const loggedProtein = todayMealLogs?.reduce((sum, log) => sum + (log.protein || 0), 0) || 0;

    // Weekly trend: calories per day
    const weeklyTrend = useMemo(() => {
        if (!weekMealLogs) return [];
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateStr = date.toISOString().split("T")[0];
            const dayLogs = weekMealLogs.filter((log) => log.date === dateStr);
            const dayCalories = dayLogs.reduce((sum, log) => sum + log.calories, 0);
            days.push({
                date: dateStr,
                dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
                calories: dayCalories,
            });
        }
        return days;
    }, [weekMealLogs, weekStart]);

    const maxCalories = Math.max(...weeklyTrend.map((d) => d.calories), targetCalories, 1);

    // Filter suggested meals
    const suggestedMeals = useMemo(() => {
        if (!allMeals) return [];
        // Filter by mealType if specified, or show all
        return allMeals.slice(0, 10); // Show top 10
    }, [allMeals]);

    const handleAddMealLog = async () => {
        if (!convexUser?._id || !newMealLog.name || !newMealLog.calories) return;

        try {
            await createMealLog({
                userId: convexUser._id,
                date: today,
                name: newMealLog.name,
                calories: parseInt(newMealLog.calories),
                protein: newMealLog.protein ? parseInt(newMealLog.protein) : undefined,
                mealType: newMealLog.mealType || undefined,
            });
            setNewMealLog({ name: "", calories: "", protein: "", mealType: "" });
        } catch (error) {
            alert("Failed to add meal log");
        }
    };

    const handleAssignMeal = async (meal: any, mealType: string) => {
        if (!convexUser?._id || !todayWorkout?.[0]?._id) {
            alert("No workout session found for today");
            return;
        }

        try {
            // Check if meal already assigned today
            const existingMeal = todayWorkout[0].meals?.find(
                (dm: any) => dm.mealType === mealType
            );

            if (existingMeal) {
                // Regenerate existing meal
                await regenerateMeal({
                    dailyMealId: existingMeal._id,
                    userId: convexUser._id,
                    planId: activePlan!._id,
                });
            } else {
                // Create new daily meal
                const order = mealType === "breakfast" ? 1 : mealType === "lunch" ? 2 : 3;
                await createDailyMeal({
                    sessionId: todayWorkout[0]._id,
                    mealId: meal._id,
                    mealType,
                    order,
                });
            }
        } catch (error) {
            alert("Failed to assign meal");
        }
    };

    if (!convexUser) {
        return (
            <Page>
                <div className="flex items-center justify-center py-12">
                    <div className="text-center text-muted-foreground">Loading...</div>
                </div>
            </Page>
        );
    }

    if (!activePlan) {
        return (
            <Page>
                <Card className="max-w-2xl mx-auto">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <h2 className="text-2xl font-semibold">No Active Plan</h2>
                            <p className="text-muted-foreground">Create a plan to view meals.</p>
                            <Button asChild className="mt-4">
                                <Link href="/generate-program">Create Plan</Link>
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
                    title="Nutrition"
                    description="Track your daily meals and nutrition goals"
                />

                {/* Daily Targets */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard
                        label="Daily Calories"
                        value={`${totalCalories} / ${targetCalories}`}
                    >
                        <div className="w-full bg-muted/50 rounded-full h-3 mt-4 overflow-hidden">
                            <div
                                className="bg-primary h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, (totalCalories / targetCalories) * 100)}%` }}
                            />
                        </div>
                    </StatCard>
                    <StatCard
                        label="Daily Protein"
                        value={`${loggedProtein}g / ${proteinTarget}g`}
                        description={loggedProtein < proteinTarget * 0.7 ? "Low protein warning" : undefined}
                    />
                </div>

                {/* Today's Meals */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Today's Meals</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Planned Meals */}
                        {todayWorkout?.[0]?.meals && todayWorkout[0].meals.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-sm mb-3">Planned Meals</h3>
                                <div className="space-y-2">
                                    {todayWorkout[0].meals.map((dailyMeal: any, idx: number) => {
                                        const meal = dailyMeal.meal;
                                        return (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-4 rounded-xl bg-card/50 shadow-soft hover:shadow-soft-lg transition-all duration-200"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium capitalize text-sm">
                                                        {dailyMeal.mealType}: {meal?.name || "Unknown"}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground mt-1">
                                                        {meal?.foods?.join(", ") || ""}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {meal?.calories || 0} kcal
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {convexUser?._id && activePlan?._id && meal?._id && (
                                                        <>
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
                                                                        alert("Failed to regenerate meal");
                                                                    }
                                                                }}
                                                            >
                                                                <RefreshCwIcon className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={async () => {
                                                                    if (!confirm(`Block "${meal?.name}"?`)) return;
                                                                    try {
                                                                        await blockItem({
                                                                            userId: convexUser._id,
                                                                            itemType: "meal",
                                                                            itemId: meal._id,
                                                                            itemName: meal.name,
                                                                        });
                                                                        alert(`${meal.name} has been blocked`);
                                                                    } catch (error) {
                                                                        alert("Failed to block meal");
                                                                    }
                                                                }}
                                                                className="text-destructive hover:text-destructive/80"
                                                            >
                                                                <BanIcon className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Logged Meals */}
                        <div className="mb-4">
                            <h3 className="font-semibold text-sm mb-2">Logged Meals</h3>
                            {todayMealLogs && todayMealLogs.length > 0 ? (
                                <div className="space-y-2">
                                    {todayMealLogs.map((log) => (
                                        <div
                                            key={log._id}
                                            className="flex items-center justify-between p-4 rounded-xl bg-card/50 shadow-soft hover:shadow-soft-lg transition-all duration-200"
                                        >
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">{log.name}</div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    {log.calories} cal{log.protein ? ` • ${log.protein}g protein` : ""}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={async () => {
                                                    if (!confirm("Delete this meal log?")) return;
                                                    try {
                                                        await deleteMealLog({ logId: log._id });
                                                    } catch (error) {
                                                        alert("Failed to delete meal log");
                                                    }
                                                }}
                                                className="text-red-500 hover:text-red-600"
                                            >
                                                <Trash2Icon className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No meals logged today.</p>
                            )}
                        </div>

                        {/* Quick Add Meal Log */}
                        <div className="rounded-xl p-5 bg-card/50 shadow-soft">
                            <h3 className="font-semibold mb-4 text-sm">Quick Log Meal</h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Meal name"
                                    value={newMealLog.name}
                                    onChange={(e) => setNewMealLog({ ...newMealLog, name: e.target.value })}
                                    className="flex-1 px-4 py-2.5 border border-border/50 rounded-xl bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                />
                                <input
                                    type="number"
                                    placeholder="Calories"
                                    value={newMealLog.calories}
                                    onChange={(e) => setNewMealLog({ ...newMealLog, calories: e.target.value })}
                                    className="w-28 px-4 py-2.5 border border-border/50 rounded-xl bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                />
                                <input
                                    type="number"
                                    placeholder="Protein (g)"
                                    value={newMealLog.protein}
                                    onChange={(e) => setNewMealLog({ ...newMealLog, protein: e.target.value })}
                                    className="w-28 px-4 py-2.5 border border-border/50 rounded-xl bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                />
                                <select
                                    value={newMealLog.mealType}
                                    onChange={(e) => setNewMealLog({ ...newMealLog, mealType: e.target.value })}
                                    className="px-4 py-2.5 border border-border/50 rounded-xl bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                >
                                    <option value="">Any</option>
                                    <option value="breakfast">Breakfast</option>
                                    <option value="lunch">Lunch</option>
                                    <option value="dinner">Dinner</option>
                                    <option value="snack">Snack</option>
                                </select>
                                <Button onClick={handleAddMealLog} size="sm" className="rounded-full">
                                    <PlusIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Suggested Meals */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Suggested Meals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {suggestedMeals && suggestedMeals.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {suggestedMeals.map((meal) => (
                                    <div
                                        key={meal._id}
                                        className="rounded-xl p-5 bg-card/50 shadow-soft hover:shadow-soft-lg transition-all duration-200"
                                    >
                                        <div className="font-semibold mb-2 text-sm">{meal.name}</div>
                                        <div className="text-sm text-muted-foreground mb-3">
                                            {meal.foods?.join(", ")}
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-4">
                                            {meal.calories} kcal
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAssignMeal(meal, "breakfast")}
                                            >
                                                Breakfast
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAssignMeal(meal, "lunch")}
                                            >
                                                Lunch
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAssignMeal(meal, "dinner")}
                                            >
                                                Dinner
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-12">No meals available.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Weekly Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Weekly Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {weeklyTrend.map((day, idx) => (
                                <div key={idx} className="flex items-center gap-4">
                                    <div className="w-20 text-sm font-medium text-muted-foreground">{day.dayName}</div>
                                    <div className="flex-1 flex items-center gap-4">
                                        <div className="flex-1 bg-muted/50 rounded-full h-3 relative overflow-hidden">
                                            <div
                                                className="bg-primary h-full rounded-full transition-all duration-300"
                                                style={{ width: `${(day.calories / maxCalories) * 100}%` }}
                                            />
                                        </div>
                                        <div className="w-24 text-sm text-right font-medium">{day.calories} cal</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Page>
    );
};

export default MealsPage;
