"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/Page";
import { DumbbellIcon, CheckIcon, PlusIcon, ArrowUpRightIcon, PencilIcon, DropletIcon, AppleIcon, MessageSquareIcon, SendIcon, ChevronDownIcon, ChevronUpIcon, TargetIcon, XIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import WaterBottle from "@/components/WaterBottle";
import StepsMountainCard from "@/components/StepsMountainCard";

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

    const activeGoal = useQuery(
        api.goals.getActiveGoal,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );

    const goalProgress = useQuery(
        api.goals.getGoalProgress,
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
    const generateTodayWorkout = useAction(api.plans.generateDailyWorkoutAndMeals);
    const deleteWorkoutSession = useMutation(api.plans.deleteWorkoutSession);
    const chatCommand = useAction(api.chat.chatCommand);
    const updateSteps = useMutation(api.dailyTracking.updateSteps);
    const updateWeight = useMutation(api.dailyTracking.updateWeight);
    const updateDistance = useMutation(api.dailyTracking.updateDistance);

    const [newMealLog, setNewMealLog] = useState({
        name: "",
        calories: "",
        protein: "",
    });

    const [goalProgressInput, setGoalProgressInput] = useState("");

    const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
        {
            role: "assistant",
            content: "Hi! I'm your fitness coach. You can ask me to:\n- Swap exercises (e.g., 'swap squats for something knee-friendly')\n- Make workouts easier (e.g., 'make today easier')\n- Add focus areas (e.g., 'add more arms this week')\n- Get meal suggestions (e.g., 'what should I eat tonight?')\n- Log meals (e.g., 'log chicken salad 450 calories 40 protein')\n- Move workouts (e.g., 'move Friday workout to Saturday')\n- Block items (e.g., 'never show burpees again')",
        },
    ]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [generatingWorkout, setGeneratingWorkout] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(new Set());
    const [waterExpanded, setWaterExpanded] = useState(false);
    const [goalExpanded, setGoalExpanded] = useState(false);

    // Calculate nutrition stats (default target calories)
    const targetCalories = 2000; // Default, can be computed from goals later
    const loggedCalories = todayMealLogs?.reduce((sum, log) => sum + log.calories, 0) || 0;
    const plannedMealCalories = todayMeals?.[0]?.meals?.reduce((sum: number, dm: any) => {
        return sum + (dm.meal?.calories || 0);
    }, 0) || 0;
    const totalCalories = loggedCalories + plannedMealCalories;

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

    // Calculate weekly workout hours
    const weekWorkoutHours = weekWorkouts?.reduce((total, w) => {
        const completed = w.exercises.every((e: any) => e.completed);
        if (completed) {
            // Estimate 1 hour per workout
            return total + 1;
        }
        return total;
    }, 0) || 0;

    // Get water intake from database
    const dailyTracking = useQuery(
        api.dailyTracking.getDailyTracking,
        convexUser?._id ? { userId: convexUser._id, date: today } : "skip"
    );

    const waterIntake = dailyTracking?.waterIntake || 0; // liters
    const waterTarget = 2.0; // liters

    // Steps from Convex
    const steps = dailyTracking?.steps || 0; // steps
    const stepsTarget = 10000; // steps

    // Calculate daily goals completion
    const dailyGoals = [
        { id: 1, label: "Sleep 7+ hours", completed: true },
        { id: 2, label: "Drink 2L of water", completed: false },
        { id: 3, label: "Complete workout", completed: todayWorkout?.exercises?.every((e: any) => e.completed) || false },
        { id: 4, label: "10,000 Steps", completed: steps >= stepsTarget },
        { id: 5, label: "1,500 Calories", completed: totalCalories >= 1500 },
    ];
    const completedGoals = dailyGoals.filter(g => g.completed).length;
    const goalsProgress = (completedGoals / dailyGoals.length) * 100;

    // Workout chart data (days of week)
    const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    const currentDay = new Date().getDay();
    const workoutChartData = days.map((day, idx) => {
        const dayIndex = idx === 0 ? 6 : idx - 1; // Monday is 0 in our array
        return {
            day,
            hours: idx === currentDay - 1 ? 1.5 : idx < currentDay ? Math.random() * 2 : 0,
            isToday: idx === currentDay - 1,
        };
    });

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
        if (!convexUser?._id || generatingWorkout) return;
        if (!activeGoal) {
            alert("Please create a goal first");
            return;
        }
        setGeneratingWorkout(true);
        try {
            await generateTodayWorkout({
                userId: convexUser._id,
                date: today,
            });
        } catch (error) {
            alert(`Failed to generate workout: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setGeneratingWorkout(false);
        }
    };

    const handleDeleteTodayWorkout = async () => {
        if (!todayWorkout?._id) return;
        if (!confirm("Are you sure you want to delete today's workout? You can regenerate it with explanations.")) {
            return;
        }
        try {
            await deleteWorkoutSession({ sessionId: todayWorkout._id });
        } catch (error) {
            alert(`Failed to delete workout: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const handleChatSend = async () => {
        if (!chatInput.trim() || !convexUser?._id || chatLoading) return;

        const userMessage = { role: "user" as const, content: chatInput.trim() };
        setChatMessages((prev) => [...prev, userMessage]);
        setChatInput("");
        setChatLoading(true);

        try {
            const response = await chatCommand({
                userId: convexUser._id,
                message: chatInput.trim(),
                date: today,
            });

            setChatMessages((prev) => [
                ...prev,
                { role: "assistant", content: response.message },
            ]);
        } catch (error) {
            setChatMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Error: ${error instanceof Error ? error.message : "Unknown error"}` },
            ]);
        } finally {
            setChatLoading(false);
        }
    };

    // Get today's meals from workout session
    const todayMealsList = todayMeals?.[0]?.meals || [];
    const plannedMeals = todayMealsList.map((dm: any) => ({
        name: dm.meal?.name || "Unknown",
        calories: dm.meal?.calories || 0,
        mealType: dm.mealType,
    }));

    if (!convexUser) {
        return (
            <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
                <div className="text-center text-[#9AA3B2]">Loading...</div>
            </div>
        );
    }

    if (!activeGoal) {
        return (
            <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center px-4">
                <Card className="max-w-2xl w-full border border-[#1B212B]">
                    <CardContent className="pt-12 pb-12">
                        <div className="text-center space-y-6">
                            <h2 className="text-2xl font-medium text-[#E6EAF0] tracking-tight">Get Started</h2>
                            <p className="text-sm text-[#9AA3B2] max-w-md mx-auto">
                                Set up your profile and create a goal to begin your fitness journey.
                            </p>
                            <div className="flex gap-3 justify-center mt-8">
                                <Button asChild size="lg" className="rounded-lg">
                                    <Link href="/profile">Create Goal</Link>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const userName = user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "User";

    return (
        <div className="min-h-screen bg-[#0B0F14]">
            <div className="flex flex-col lg:flex-row gap-6 p-6 h-[calc(100vh-4rem)]">
                {/* Left Side - Dashboard Content */}
                <div className="flex-1 overflow-y-auto lg:pr-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Workouts Card */}
                        <div>
                            <Card className="h-full border border-[#1B212B]">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-medium text-white">This Week</CardTitle>
                                        <Link href="/workouts">
                                            <button className="text-white/70 hover:text-white transition-colors">
                                                <ArrowUpRightIcon size={16} />
                                            </button>
                                        </Link>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {/* Bar Chart */}
                                    <div className="flex items-end justify-between gap-1.5 mb-6 h-32">
                                        {workoutChartData.map((item, idx) => (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                                <div
                                                    className={cn(
                                                        "w-full rounded-sm transition-all",
                                                        item.isToday
                                                            ? "bg-[#C7F000]"
                                                            : item.hours > 0
                                                                ? "bg-[#6B7280]"
                                                                : "bg-[#1B212B]"
                                                    )}
                                                    style={{
                                                        height: item.hours > 0 ? `${Math.max(20, Math.min(100, (item.hours / 2) * 100))}%` : "4px",
                                                    }}
                                                />
                                                <span className={cn(
                                                    "text-[11px] font-medium",
                                                    item.isToday ? "text-white" : "text-white/60"
                                                )}>
                                                    {item.day}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-4 border-t border-[#1B212B]">
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-xs text-white/70 font-medium">Total hours</span>
                                            <span className="text-2xl font-medium text-white tracking-tight">{weekWorkoutHours}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Steps Card */}
                        <div>
                            <Card className="h-full border border-[#1B212B]">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base font-medium text-white">Steps</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex items-baseline justify-between mb-3">
                                                <span className="text-3xl font-medium text-white tracking-tight">
                                                    {steps.toLocaleString()}
                                                </span>
                                                <span className="text-sm text-white/60">
                                                    / {stepsTarget.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-[#1B212B] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#C7F000] rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.min(100, (steps / stepsTarget) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-[#1B212B]">
                                            <label className="block text-xs text-white/70 font-medium mb-2">
                                                Update steps
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max={stepsTarget * 1.5}
                                                value={steps}
                                                onChange={async (e) => {
                                                    if (!convexUser?._id) return;
                                                    try {
                                                        await updateSteps({
                                                            userId: convexUser._id,
                                                            date: today,
                                                            steps: Number(e.target.value),
                                                        });
                                                    } catch (error) {
                                                        console.error("Failed to update steps:", error);
                                                    }
                                                }}
                                                className="w-full h-1 bg-[#1B212B] rounded-full appearance-none cursor-pointer accent-[#C7F000]"
                                            />
                                            <div className="flex justify-between mt-1 text-[10px] text-white/60">
                                                <span>0</span>
                                                <span>{Math.round(stepsTarget * 1.5).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Water Card */}
                        <div>
                            <Card className="h-full border border-[#1B212B] cursor-pointer hover:border-[#6B7280]/50 transition-colors" onClick={() => setWaterExpanded(true)}>
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base font-medium text-white">Water</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex items-baseline justify-between mb-3">
                                                <span className="text-3xl font-medium text-white tracking-tight">
                                                    {waterIntake.toFixed(1)}<span className="text-lg text-white/60">L</span>
                                                </span>
                                                <span className="text-sm text-white/60">
                                                    / {waterTarget}L
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-[#1B212B] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#C7F000] rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.min(100, (waterIntake / waterTarget) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-[#1B212B]">
                                            <p className="text-xs text-white/70">Tap to track water intake</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Daily Goals Card */}
                        <div>
                            <Card className="h-full border border-[#1B212B]">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-medium text-white">Today</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1">
                                        {dailyGoals.map((goal) => (
                                            <div key={goal.id} className="flex items-center gap-3 py-2.5">
                                                <div className={cn(
                                                    "size-5 rounded-sm flex items-center justify-center flex-shrink-0 border",
                                                    goal.completed
                                                        ? "bg-[#C7F000] border-[#C7F000] text-[#0B0F14]"
                                                        : "bg-transparent border-[#6B7280] text-transparent"
                                                )}>
                                                    {goal.completed && <CheckIcon size={12} strokeWidth={2.5} />}
                                                </div>
                                                <span className={cn(
                                                    "text-sm flex-1 font-medium",
                                                    goal.completed ? "text-[#E6EAF0]" : "text-[#9AA3B2]"
                                                )}>
                                                    {goal.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-4 mt-4 border-t border-[#1B212B]">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#9AA3B2] font-medium">Progress</span>
                                            <span className="text-sm font-medium text-[#E6EAF0]">{completedGoals} of {dailyGoals.length}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Current Goal Card */}
                        <div>
                            <Card className="h-full border border-[#1B212B]">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-medium text-white">Active Goal</CardTitle>
                                        {activeGoal && (
                                            <Link href="/profile">
                                                <button className="text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors">
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                            </Link>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {activeGoal ? (() => {
                                        const hasCoachingPlan = activeGoal.name || activeGoal.summary || activeGoal.reasoning;
                                        const goalName = activeGoal.name || (
                                            activeGoal.category === "body_composition" && activeGoal.direction
                                                ? `${activeGoal.direction.charAt(0).toUpperCase() + activeGoal.direction.slice(1)}${activeGoal.value && activeGoal.unit ? ` ${activeGoal.value} ${activeGoal.unit}` : ""}`
                                                : activeGoal.category === "strength" && activeGoal.target?.exercise
                                                    ? activeGoal.target.exercise
                                                    : activeGoal.category === "endurance" && activeGoal.target?.movement
                                                        ? activeGoal.target.movement
                                                        : activeGoal.category === "mobility" && activeGoal.target?.movement
                                                            ? activeGoal.target.movement
                                                            : activeGoal.category === "skill" && activeGoal.target?.movement
                                                                ? activeGoal.target.movement
                                                                : activeGoal.category === "body_composition" ? "Body Composition"
                                                                    : activeGoal.category === "strength" ? "Strength"
                                                                    : activeGoal.category === "endurance" ? "Endurance"
                                                                    : activeGoal.category === "mobility" ? "Mobility"
                                                                    : "Skill"
                                        );
                                        const categoryLabel = activeGoal.category === "body_composition" ? "Body Composition"
                                            : activeGoal.category === "strength" ? "Strength"
                                            : activeGoal.category === "endurance" ? "Endurance"
                                            : activeGoal.category === "mobility" ? "Mobility"
                                            : "Skill";

                                        return (
                                            <div className="space-y-4">
                                                <div className="pt-2">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-xs font-medium text-[#9AA3B2] uppercase tracking-wide">
                                                            {categoryLabel}
                                                        </span>
                                                        {hasCoachingPlan && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                onClick={() => setGoalExpanded(!goalExpanded)}
                                                                className="h-6 w-6"
                                                            >
                                                                {goalExpanded ? (
                                                                    <ChevronUpIcon className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronDownIcon className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <p className="text-xl font-medium text-[#E6EAF0] mb-1 tracking-tight">
                                                        {goalName}
                                                    </p>
                                                    {activeGoal.summary && (
                                                        <p className="text-sm text-[#9AA3B2] mt-2 leading-relaxed">
                                                            {activeGoal.summary}
                                                        </p>
                                                    )}
                                                    {!hasCoachingPlan && (
                                                        <>
                                                            {activeGoal.category === "body_composition" && activeGoal.direction && activeGoal.value && activeGoal.unit && (
                                                                <p className="text-sm text-[#9AA3B2] mt-1">
                                                                    Target: {activeGoal.value} {activeGoal.unit}
                                                                </p>
                                                            )}
                                                            {activeGoal.category === "strength" && activeGoal.target?.exercise && activeGoal.value && activeGoal.unit && (
                                                                <p className="text-sm text-[#9AA3B2] mt-1">
                                                                    Target: {activeGoal.value} {activeGoal.unit}
                                                                </p>
                                                            )}
                                                            {activeGoal.category === "endurance" && activeGoal.target?.movement && activeGoal.value && activeGoal.unit && (
                                                                <p className="text-sm text-[#9AA3B2] mt-1">
                                                                    Target: {activeGoal.value} {activeGoal.unit}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                {/* Expanded view with coaching explanation */}
                                                {goalExpanded && hasCoachingPlan && (
                                                    <div className="pt-4 border-t border-[#1B212B] space-y-6">
                                                        {/* Goal Reasoning */}
                                                        {activeGoal.reasoning && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-[#E6EAF0] mb-2">Goal Reasoning</h4>
                                                                <p className="text-sm text-[#9AA3B2] leading-relaxed whitespace-pre-wrap">
                                                                    {activeGoal.reasoning}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {/* Program Overview */}
                                                        {activeGoal.programOverview && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-[#E6EAF0] mb-2">Program Overview</h4>
                                                                <p className="text-sm text-[#9AA3B2] mb-2">
                                                                    <span className="font-medium">Duration:</span> {activeGoal.programOverview.durationWeeks} weeks
                                                                </p>
                                                                <p className="text-sm text-[#9AA3B2] leading-relaxed whitespace-pre-wrap">
                                                                    {activeGoal.programOverview.highLevelStrategy}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {/* Training Phases */}
                                                        {activeGoal.phases && activeGoal.phases.length > 0 && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-[#E6EAF0] mb-3">Training Phases</h4>
                                                                <div className="space-y-4">
                                                                    {activeGoal.phases.map((phase: any, idx: number) => (
                                                                        <div key={idx} className="pl-4 border-l-2 border-[#C7F000]/20">
                                                                            <div className="flex items-baseline gap-2 mb-1">
                                                                                <h5 className="text-sm font-medium text-[#E6EAF0]">{phase.name}</h5>
                                                                                <span className="text-xs text-[#9AA3B2]">({phase.weeks})</span>
                                                                            </div>
                                                                            {phase.goal && (
                                                                                <p className="text-xs font-medium text-[#9AA3B2] mb-1">{phase.goal}</p>
                                                                            )}
                                                                            <p className="text-sm text-[#9AA3B2] leading-relaxed whitespace-pre-wrap">
                                                                                {phase.description}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Training Principles */}
                                                        {activeGoal.trainingPrinciples && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-[#E6EAF0] mb-3">Training Principles</h4>
                                                                <div className="space-y-4">
                                                                    {activeGoal.trainingPrinciples.volumeVsIntensity && (
                                                                        <div>
                                                                            <h5 className="text-xs font-medium text-[#9AA3B2] mb-1 uppercase tracking-wide">Volume vs Intensity</h5>
                                                                            <p className="text-sm text-[#9AA3B2] leading-relaxed whitespace-pre-wrap">
                                                                                {activeGoal.trainingPrinciples.volumeVsIntensity}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {activeGoal.trainingPrinciples.recoveryAndFatigue && (
                                                                        <div>
                                                                            <h5 className="text-xs font-medium text-[#9AA3B2] mb-1 uppercase tracking-wide">Recovery and Fatigue Management</h5>
                                                                            <p className="text-sm text-[#9AA3B2] leading-relaxed whitespace-pre-wrap">
                                                                                {activeGoal.trainingPrinciples.recoveryAndFatigue}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {activeGoal.trainingPrinciples.stallAdaptation && (
                                                                        <div>
                                                                            <h5 className="text-xs font-medium text-[#9AA3B2] mb-1 uppercase tracking-wide">Handling Stalls</h5>
                                                                            <p className="text-sm text-[#9AA3B2] leading-relaxed whitespace-pre-wrap">
                                                                                {activeGoal.trainingPrinciples.stallAdaptation}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })() : (
                                        <div className="text-center py-12">
                                            <TargetIcon className="h-8 w-8 mx-auto mb-3 text-[#6B7280]" />
                                            <p className="text-sm text-[#9AA3B2] mb-4">No active goal</p>
                                            <Link href="/profile">
                                                <Button variant="outline" size="sm">
                                                    <PlusIcon className="h-4 w-4 mr-1.5" />
                                                    Create Goal
                                                </Button>
                                            </Link>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Goal Progress Card */}
                        {goalProgress && (
                            <div>
                                <Card className="h-full border border-[#1B212B]">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-base font-medium text-white">Progress</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-8">
                                            {/* Progress Bar */}
                                            {goalProgress.currentValue !== null && goalProgress.targetValue !== null && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-xs font-medium text-[#9AA3B2]">
                                                            {goalProgress.goal.category === "strength" && goalProgress.goal.target?.exercise && goalProgress.goal.target.exercise}
                                                            {goalProgress.goal.category === "endurance" && goalProgress.goal.target?.movement && goalProgress.goal.target.movement}
                                                            {goalProgress.goal.category === "body_composition" && "Weight"}
                                                        </span>
                                                        <span className="text-sm font-medium text-[#E6EAF0]">
                                                            {goalProgress.goal.category === "body_composition"
                                                                ? `${goalProgress.currentValue.toFixed(1)} ${goalProgress.unit} → ${goalProgress.targetValue.toFixed(1)} ${goalProgress.unit}`
                                                                : `${goalProgress.currentValue.toFixed(goalProgress.goal.category === "endurance" ? 1 : 0)} ${goalProgress.unit} / ${goalProgress.targetValue.toFixed(goalProgress.goal.category === "endurance" ? 1 : 0)} ${goalProgress.unit}`
                                                            }
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-[#1B212B] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-[#C7F000] rounded-full transition-all duration-500"
                                                            style={{ width: `${Math.min(100, goalProgress.progressPercent)}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-right mt-2">
                                                        <span className="text-xs text-[#9AA3B2]">
                                                            {Math.round(goalProgress.progressPercent)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Progress Chart */}
                                            <div>
                                                <div className="text-xs font-medium text-[#9AA3B2] mb-4">Progress Over Time</div>
                                                {goalProgress.progressData && goalProgress.progressData.length > 0 ? (
                                                    <div className="relative">
                                                        {/* Chart Container */}
                                                        <div className="flex items-end justify-between gap-0.5 h-40 mb-3 pb-4 border-b border-[#1B212B]">
                                                            {goalProgress.progressData.slice(-14).map((point, idx) => {
                                                                const maxValue = Math.max(...goalProgress.progressData.map(p => p.value));
                                                                const minValue = Math.min(...goalProgress.progressData.map(p => p.value));
                                                                const range = maxValue - minValue || 1;
                                                                const heightPercent = ((point.value - minValue) / range) * 100;
                                                                const isLatest = idx === goalProgress.progressData.slice(-14).length - 1;
                                                                return (
                                                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 relative group">
                                                                        <div
                                                                            className={cn(
                                                                                "w-full rounded-sm transition-all hover:opacity-80 cursor-pointer",
                                                                                isLatest
                                                                                    ? "bg-[#C7F000]"
                                                                                    : "bg-[#6B7280]"
                                                                            )}
                                                                            style={{ height: `${Math.max(8, heightPercent)}%` }}
                                                                            title={`${point.value.toFixed(goalProgress.goal.category === "body_composition" ? 1 : 0)} ${goalProgress.unit} on ${new Date(point.date).toLocaleDateString()}`}
                                                                        />
                                                                        {/* Tooltip on hover */}
                                                                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#161B22] text-[#E6EAF0] text-xs px-2 py-1 rounded border border-[#1B212B] whitespace-nowrap z-10">
                                                                            {point.value.toFixed(goalProgress.goal.category === "body_composition" ? 1 : 0)} {goalProgress.unit}
                                                                            <div className="text-[#9AA3B2] text-[10px] mt-0.5">
                                                                                {new Date(point.date).toLocaleDateString()}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        {/* X-axis labels */}
                                                        <div className="flex items-end justify-between gap-0.5 mt-1">
                                                            {goalProgress.progressData.slice(-14).map((point, idx) => {
                                                                if (idx % 3 !== 0 && idx !== goalProgress.progressData.slice(-14).length - 1) return null;
                                                                return (
                                                                    <div key={idx} className="flex-1 text-center">
                                                                        <div className="text-[10px] text-[#6B7280]">
                                                                            {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-40 flex items-center justify-center border border-[#1B212B] rounded-lg bg-[#161B22]/30">
                                                        <p className="text-xs text-[#9AA3B2]">No progress data yet</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Stats */}
                                            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#1B212B]">
                                                <div>
                                                    <div className="text-xs text-[#9AA3B2] font-medium mb-1">Days Active</div>
                                                    <div className="text-xl font-medium text-[#E6EAF0] tracking-tight">{goalProgress.daysElapsed}</div>
                                                </div>
                                                {goalProgress.currentValue !== null && goalProgress.targetValue !== null && (
                                                    <div>
                                                        <div className="text-xs text-[#9AA3B2] font-medium mb-1">
                                                            {goalProgress.goal.category === "body_composition" ? "Remaining" : "To Go"}
                                                        </div>
                                                        <div className="text-xl font-medium text-[#E6EAF0] tracking-tight">
                                                            {goalProgress.goal.category === "body_composition"
                                                                ? `${Math.abs(goalProgress.currentValue - goalProgress.targetValue).toFixed(1)} ${goalProgress.unit}`
                                                                : `${Math.max(0, (goalProgress.targetValue - goalProgress.currentValue)).toFixed(goalProgress.goal.category === "endurance" ? 1 : 0)} ${goalProgress.unit}`
                                                            }
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Update Progress Input */}
                                            <div className="pt-4 border-t border-[#1B212B]">
                                                <div className="text-xs font-medium text-[#9AA3B2] mb-3">
                                                    {goalProgress.goal.category === "body_composition" && "Update Weight"}
                                                    {goalProgress.goal.category === "endurance" && "Log Distance"}
                                                    {goalProgress.goal.category === "strength" && "Progress updates automatically when you complete workouts"}
                                                </div>
                                                {(goalProgress.goal.category === "body_composition" || goalProgress.goal.category === "endurance") && (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="number"
                                                            step={goalProgress.goal.category === "body_composition" ? "0.1" : "0.01"}
                                                            placeholder={goalProgress.goal.category === "body_composition" ? `Weight (${goalProgress.unit})` : `Distance (${goalProgress.unit})`}
                                                            value={goalProgressInput}
                                                            onChange={(e) => setGoalProgressInput(e.target.value)}
                                                            className="flex-1 px-4 py-2 bg-[#161B22] text-[#E6EAF0] placeholder:text-[#6B7280] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C7F000]/20 transition-all border border-[#1B212B]"
                                                        />
                                                        <Button
                                                            onClick={async () => {
                                                                if (!goalProgressInput || !convexUser?._id) return;
                                                                try {
                                                                    const value = parseFloat(goalProgressInput);
                                                                    if (isNaN(value)) {
                                                                        alert("Please enter a valid number");
                                                                        return;
                                                                    }

                                                                    if (goalProgress.goal.category === "body_composition") {
                                                                        // Convert to kg if unit is lbs
                                                                        const weightKg = goalProgress.unit.toLowerCase().includes("lb")
                                                                            ? value / 2.20462
                                                                            : value;
                                                                        await updateWeight({
                                                                            userId: convexUser._id,
                                                                            date: today,
                                                                            weight_kg: weightKg,
                                                                        });
                                                                    } else if (goalProgress.goal.category === "endurance") {
                                                                        // Convert to km if unit is miles
                                                                        const distanceKm = goalProgress.unit.toLowerCase().includes("mile")
                                                                            ? value / 0.621371
                                                                            : value;
                                                                        await updateDistance({
                                                                            userId: convexUser._id,
                                                                            date: today,
                                                                            distance_km: distanceKm,
                                                                        });
                                                                    }
                                                                    setGoalProgressInput("");
                                                                } catch (error) {
                                                                    alert(`Failed to update progress: ${error instanceof Error ? error.message : "Unknown error"}`);
                                                                }
                                                            }}
                                                            size="sm"
                                                            className="rounded-lg"
                                                        >
                                                            Update
                                                        </Button>
                                                    </div>
                                                )}
                                                {goalProgress.goal.category === "strength" && (
                                                    <div className="text-xs text-[#6B7280]">
                                                        Complete sets with {goalProgress.goal.target?.exercise} in your workouts to automatically track progress.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Daily Meals Card - Full Width */}
                        <div className="md:col-span-2">
                            <Card className="h-full border border-[#1B212B]">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-medium text-white">Nutrition</CardTitle>
                                        <Link href="/meals">
                                            <button className="text-white/70 hover:text-white transition-colors">
                                                <ArrowUpRightIcon size={16} />
                                            </button>
                                        </Link>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        {/* Calories Progress */}
                                        <div>
                                            <div className="flex items-baseline justify-between mb-3">
                                                <span className="text-xs font-medium text-white/70">Calories</span>
                                                <span className="text-2xl font-medium text-white tracking-tight">
                                                    {totalCalories} <span className="text-sm text-white/60">/ {targetCalories}</span>
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-[#1B212B] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#C7F000] rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.min(100, ((totalCalories / targetCalories) * 100))}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Planned Meals */}
                                        {plannedMeals.length > 0 && (
                                            <div className="space-y-2">
                                                <h3 className="text-xs font-medium text-white/70 uppercase tracking-wide mb-3">Planned</h3>
                                                {plannedMeals.map((meal, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between py-2.5 border-b border-[#1B212B] last:border-0"
                                                    >
                                                        <div>
                                                            <div className="text-sm font-medium text-white capitalize">{meal.mealType}</div>
                                                            <div className="text-xs text-white/70 mt-0.5">{meal.name}</div>
                                                        </div>
                                                        <span className="text-xs text-white/70">{meal.calories} cal</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Logged Meals */}
                                        {todayMealLogs && todayMealLogs.length > 0 && (
                                            <div className="space-y-2">
                                                <h3 className="text-xs font-medium text-white/70 uppercase tracking-wide mb-3">Logged</h3>
                                                {todayMealLogs.map((log) => (
                                                    <div
                                                        key={log._id}
                                                        className="flex items-center justify-between py-2.5 border-b border-[#1B212B] last:border-0"
                                                    >
                                                        <div>
                                                            <div className="text-sm font-medium text-white">{log.name}</div>
                                                            {log.protein && (
                                                                <div className="text-xs text-white/70 mt-0.5">{log.protein}g protein</div>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-white/70">{log.calories} cal</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Quick Add Meal */}
                                        <div className="pt-4 border-t border-[#1B212B]">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Meal name"
                                                    value={newMealLog.name}
                                                    onChange={(e) => setNewMealLog({ ...newMealLog, name: e.target.value })}
                                                    className="flex-1 px-3 py-2 bg-[#161B22] text-white placeholder:text-white/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C7F000]/20 transition-all border border-[#1B212B]"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Cal"
                                                    value={newMealLog.calories}
                                                    onChange={(e) => setNewMealLog({ ...newMealLog, calories: e.target.value })}
                                                    className="w-20 px-3 py-2 bg-[#161B22] text-white placeholder:text-white/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C7F000]/20 transition-all border border-[#1B212B]"
                                                />
                                                <Button
                                                    onClick={handleAddMealLog}
                                                    size="sm"
                                                    className="rounded-lg"
                                                >
                                                    <PlusIcon className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Today's Plan Explanation Panel - Above Workout */}
                        {todayWorkout && (
                            <div className="md:col-span-2">
                                <Card className="h-full border border-[#1B212B]">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base font-medium text-white">Today's Plan</CardTitle>
                                            {(!todayWorkout.workoutExplanation || (!todayWorkout.mealExplanation && !todayMeals?.[0]?.mealExplanation)) && (
                                                <Button
                                                    onClick={handleDeleteTodayWorkout}
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-white/70 hover:text-white text-xs"
                                                >
                                                    Regenerate
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-6">
                                            {todayWorkout.workoutExplanation ? (
                                                <div className="pt-2">
                                                    <div className="mb-3">
                                                        <span className="text-xs font-medium text-white/70 uppercase tracking-wide">
                                                            Workout Strategy
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-white leading-relaxed">
                                                        {todayWorkout.workoutExplanation}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="pt-2">
                                                    <div className="mb-3">
                                                        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
                                                            Workout Strategy
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-white/70 leading-relaxed">
                                                        Generate a new workout to see the strategy explanation.
                                                    </p>
                                                </div>
                                            )}
                                            {(todayWorkout.mealExplanation || todayMeals?.[0]?.mealExplanation) ? (
                                                <div className="pt-4 border-t border-[#1B212B]">
                                                    <div className="mb-3">
                                                        <span className="text-xs font-medium text-white/70 uppercase tracking-wide">
                                                            Nutrition Strategy
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-white leading-relaxed">
                                                        {todayWorkout.mealExplanation || todayMeals?.[0]?.mealExplanation}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="pt-4 border-t border-[#1B212B]">
                                                    <div className="mb-3">
                                                        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
                                                            Nutrition Strategy
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-white/70 leading-relaxed">
                                                        Generate a new workout to see the nutrition strategy explanation.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Today's Workout Card */}
                        <div className="md:col-span-2">

                            <Card className="h-full border border-[#1B212B]">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-medium text-white">Today's Workout</CardTitle>
                                        {!todayWorkout && (
                                            <Button
                                                onClick={handleGenerateToday}
                                                size="sm"
                                                disabled={generatingWorkout}
                                                className="rounded-lg"
                                            >
                                                {generatingWorkout ? "Generating..." : "Generate"}
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
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
                                                    const isCollapsed = collapsedExercises.has(idx);
                                                    const toggleCollapse = () => {
                                                        const newCollapsed = new Set(collapsedExercises);
                                                        if (isCollapsed) {
                                                            newCollapsed.delete(idx);
                                                        } else {
                                                            newCollapsed.add(idx);
                                                        }
                                                        setCollapsedExercises(newCollapsed);
                                                    };

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={cn(
                                                                "rounded-lg p-4 transition-all duration-200 border",
                                                                allCompleted
                                                                    ? "bg-[#161B22] border-[#1B212B]"
                                                                    : "bg-[#161B22] border-[#1B212B] hover:border-[#6B7280]/50"
                                                            )}
                                                        >
                                                            <div className="font-medium mb-3 flex items-center justify-between">
                                                                <div className="flex items-center gap-2 flex-1">
                                                                    <button
                                                                        onClick={toggleCollapse}
                                                                        className="p-1 rounded hover:bg-[#1B212B] transition-colors"
                                                                        aria-label={isCollapsed ? "Expand exercise" : "Collapse exercise"}
                                                                    >
                                                                        {isCollapsed ? (
                                                                            <ChevronDownIcon className="h-4 w-4 text-[#9AA3B2]" />
                                                                        ) : (
                                                                            <ChevronUpIcon className="h-4 w-4 text-[#9AA3B2]" />
                                                                        )}
                                                                    </button>
                                                                    <span className="text-sm font-medium text-[#E6EAF0]">{exercise?.name || "Unknown"}</span>
                                                                </div>
                                                                {allCompleted && (
                                                                    <div className="size-5 rounded-sm bg-[#C7F000] flex items-center justify-center">
                                                                        <CheckIcon className="h-3 w-3 text-[#0B0F14]" strokeWidth={2.5} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {!isCollapsed && (
                                                                <div className="space-y-2 text-sm pt-2 border-t border-[#1B212B]">
                                                                    {setsForExercise.map((set: any, setIdx: number) => (
                                                                        <div
                                                                            key={setIdx}
                                                                            className={cn(
                                                                                "flex items-center justify-between py-2",
                                                                                set.completed ? "text-[#E6EAF0]" : "text-[#9AA3B2]"
                                                                            )}
                                                                        >
                                                                            <span className="text-sm">
                                                                                Set {set.setNumber}: {set.actualWeight || set.plannedWeight} lbs × {set.actualReps || set.plannedReps} reps
                                                                            </span>
                                                                            {!set.completed && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
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
                                                                                    className="text-xs h-7 px-3"
                                                                                >
                                                                                    Complete
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            <Link href="/workouts">
                                                <Button variant="outline" className="w-full mt-6 rounded-lg">
                                                    View Full Workout
                                                </Button>
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 text-[#9AA3B2]">
                                            <p className="mb-2 text-sm">No workout scheduled for today</p>
                                            <p className="text-xs text-[#6B7280]">Generate a workout to get started</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

                {/* Right Side - AI Assistant Chat */}
                <div className="w-full lg:w-96 flex-shrink-0 lg:h-full">
                    <Card className="flex flex-col h-full border border-[#1B212B]">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base font-medium text-[#E6EAF0]">AI Assistant</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col flex-1 min-h-0">
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                                {chatMessages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "max-w-[85%] rounded-lg p-3",
                                            msg.role === "user"
                                                ? "bg-[#1B212B] text-[#E6EAF0] ml-auto border border-[#1B212B]"
                                                : "bg-[#161B22] text-[#E6EAF0] border border-[#1B212B]"
                                        )}
                                    >
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="bg-[#161B22] rounded-lg p-3 max-w-[85%] border border-[#1B212B]">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <div className="w-1.5 h-1.5 bg-[#9AA3B2] rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                                                <div className="w-1.5 h-1.5 bg-[#9AA3B2] rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                                                <div className="w-1.5 h-1.5 bg-[#9AA3B2] rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                                            </div>
                                            <span className="text-xs text-[#9AA3B2]">Thinking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="flex gap-2 pt-4 border-t border-[#1B212B]">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                                    placeholder="Ask me anything..."
                                    className="flex-1 px-4 py-2 bg-[#161B22] text-[#E6EAF0] placeholder:text-[#6B7280] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C7F000]/20 transition-all border border-[#1B212B]"
                                    disabled={chatLoading}
                                />
                                <Button
                                    onClick={handleChatSend}
                                    disabled={chatLoading || !chatInput.trim()}
                                    size="sm"
                                    className="rounded-lg"
                                >
                                    <SendIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Water Bottle Expanded Modal */}
            {waterExpanded && convexUser?._id && (
                <div
                    className="fixed inset-0 bg-[#0B0F14]/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setWaterExpanded(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#161B22] rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-[#1B212B]"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-medium text-[#E6EAF0] tracking-tight">Water Tracker</h2>
                            <button
                                onClick={() => setWaterExpanded(false)}
                                className="p-2 rounded-lg hover:bg-[#1B212B] text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
                            <WaterBottle
                                userId={convexUser._id}
                                date={today}
                                targetAmount={waterTarget}
                                compact={false}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;
