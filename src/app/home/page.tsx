"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/Page";
import { DumbbellIcon, CheckIcon, PlusIcon, ArrowUpRightIcon, PencilIcon, DropletIcon, AppleIcon, MessageSquareIcon, SendIcon, ChevronDownIcon, ChevronUpIcon, TargetIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import WaterBottle from "@/components/WaterBottle";

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

    const [newMealLog, setNewMealLog] = useState({
        name: "",
        calories: "",
        protein: "",
    });

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

    // Calculate daily goals completion
    const dailyGoals = [
        { id: 1, label: "Sleep 7+ hours", completed: true, icon: "😴" },
        { id: 2, label: "Drink 2L of water", completed: false, icon: "💧" },
        { id: 3, label: "Complete workout", completed: todayWorkout?.exercises?.every((e: any) => e.completed) || false, icon: "💪" },
        { id: 4, label: "10 000 Steps", completed: false, icon: "🚶" },
        { id: 5, label: "1 500 Calories", completed: totalCalories >= 1500, icon: "🍎" },
    ];
    const completedGoals = dailyGoals.filter(g => g.completed).length;
    const goalsProgress = (completedGoals / dailyGoals.length) * 100;

    // Get water intake from database
    const dailyTracking = useQuery(
        api.dailyTracking.getDailyTracking,
        convexUser?._id ? { userId: convexUser._id, date: today } : "skip"
    );

    const waterIntake = dailyTracking?.waterIntake || 0; // liters
    const waterTarget = 2.0; // liters

    // Steps (mock data)
    const steps = 5400; // steps
    const stepsTarget = 10000; // steps
    const stepsKm = (steps * 0.0008).toFixed(1); // approximate conversion
    const stepsProgress = (steps / stepsTarget) * 100;

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
                <Card className="max-w-2xl w-full">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <h2 className="text-2xl font-semibold text-[#E6EAF0]">Welcome to Your Fitness Journey</h2>
                            <p className="text-[#9AA3B2]">
                                Let's set up your profile and create a goal to get started.
                            </p>
                            <div className="flex gap-3 justify-center mt-6">
                                <Button asChild size="lg">
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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Greeting */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-4xl sm:text-5xl font-semibold text-[#E6EAF0]">
                        Hello, <span className="text-[#C7F000]">{userName}</span>
                    </h1>
                </motion.div>

                {/* Organic Card Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Workouts Card - Top Left */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="lg:col-span-4"
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-[#E6EAF0]">Workouts</CardTitle>
                                    <button className="size-8 rounded-full bg-[#161B22] flex items-center justify-center text-[#9AA3B2] hover:text-[#E6EAF0] hover:bg-[#1B212B] transition-all">
                                        <ArrowUpRightIcon size={16} />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Bar Chart */}
                                <div className="flex items-end justify-between gap-2 mb-4 h-24">
                                    {workoutChartData.map((item, idx) => (
                                        <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                            <div
                                                className={cn(
                                                    "w-full rounded-t transition-all",
                                                    item.isToday
                                                        ? "bg-[#C7F000] h-full"
                                                        : item.hours > 0
                                                            ? "bg-[#E6EAF0] h-full"
                                                            : "bg-[#6B7280] h-2"
                                                )}
                                                style={{
                                                    height: item.hours > 0 ? `${Math.min(100, (item.hours / 2) * 100)}%` : "8px",
                                                }}
                                            />
                                            <span className={cn(
                                                "text-xs",
                                                item.isToday ? "text-[#C7F000]" : "text-[#6B7280]"
                                            )}>
                                                {item.day}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[#9AA3B2]">Total</span>
                                    <span className="text-xl font-semibold text-[#E6EAF0]">{weekWorkoutHours}h</span>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Steps Card - Middle Left */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="lg:col-span-4"
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-[#E6EAF0]">Steps</CardTitle>
                                    <button className="size-8 rounded-full bg-[#161B22] flex items-center justify-center text-[#9AA3B2] hover:text-[#E6EAF0] hover:bg-[#1B212B] transition-all">
                                        <ArrowUpRightIcon size={16} />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Circular Progress */}
                                <div className="flex items-center justify-center mb-4">
                                    <div className="relative size-32">
                                        <svg className="transform -rotate-90 size-32">
                                            <circle
                                                cx="64"
                                                cy="64"
                                                r="56"
                                                stroke="#161B22"
                                                strokeWidth="12"
                                                fill="none"
                                            />
                                            <circle
                                                cx="64"
                                                cy="64"
                                                r="56"
                                                stroke="#C7F000"
                                                strokeWidth="12"
                                                fill="none"
                                                strokeDasharray={`${2 * Math.PI * 56}`}
                                                strokeDashoffset={`${2 * Math.PI * 56 * (1 - stepsProgress / 100)}`}
                                                strokeLinecap="round"
                                                className="transition-all duration-500"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="text-xl font-semibold text-[#E6EAF0]">{stepsKm}km</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[#9AA3B2]">Goal</span>
                                    <span className="text-xl font-semibold text-[#E6EAF0]">10km</span>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Water Card - Middle */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="lg:col-span-4"
                    >
                        <Card className="h-full relative overflow-hidden cursor-pointer" onClick={() => setWaterExpanded(true)}>
                            <CardHeader>
                                <CardTitle className="text-[#E6EAF0]">Water</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-center py-4">
                                    {convexUser?._id && (
                                        <WaterBottle
                                            userId={convexUser._id}
                                            date={today}
                                            targetAmount={waterTarget}
                                            compact={true}
                                            onExpand={() => setWaterExpanded(true)}
                                        />
                                    )}
                                </div>
                                <div className="flex items-center justify-between mt-4">
                                    <span className="text-sm text-[#9AA3B2]">Today</span>
                                    <span className="text-xl font-semibold text-[#E6EAF0]">{waterIntake.toFixed(1)}L / {waterTarget}L</span>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Daily Goals Card - Right Column, Top */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="lg:col-span-6"
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-[#E6EAF0]">Daily goals</CardTitle>
                                    <button className="size-8 rounded-full bg-[#161B22] flex items-center justify-center text-[#9AA3B2] hover:text-[#E6EAF0] hover:bg-[#1B212B] transition-all">
                                        <PencilIcon size={16} />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {dailyGoals.map((goal) => (
                                        <div key={goal.id} className="flex items-center gap-3">
                                            <div className={cn(
                                                "size-6 rounded-full flex items-center justify-center text-xs",
                                                goal.completed
                                                    ? "bg-[#C7F000] text-[#0B0F14]"
                                                    : "bg-[#6B7280] text-[#9AA3B2]"
                                            )}>
                                                {goal.completed && <CheckIcon size={14} />}
                                            </div>
                                            <span className="text-sm text-[#9AA3B2]">{goal.icon}</span>
                                            <span className={cn(
                                                "text-sm flex-1",
                                                goal.completed ? "text-[#E6EAF0]" : "text-[#9AA3B2]"
                                            )}>
                                                {goal.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Current Goal Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                        className="lg:col-span-6"
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-3 text-xl text-[#E6EAF0]">
                                        <div className="p-2.5 bg-gradient-to-br from-[#C7F000]/20 to-[#C7F000]/10 rounded-xl">
                                            <TargetIcon className="h-5 w-5 text-[#C7F000]" />
                                        </div>
                                        Current Goal
                                    </CardTitle>
                                    {activeGoal && (
                                        <Link href="/profile">
                                            <Button variant="ghost" size="sm" className="text-[#9AA3B2] hover:text-[#C7F000]">
                                                <PencilIcon className="h-4 w-4 mr-1" />
                                                Edit goal
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {activeGoal ? (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-xl bg-[#1B212B] border border-[#C7F000]/20">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 w-2 h-2 rounded-full bg-[#C7F000] flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-sm font-semibold text-[#C7F000] uppercase tracking-wide">
                                                            {activeGoal.category === "body_composition" && "Body Composition"}
                                                            {activeGoal.category === "strength" && "Strength"}
                                                            {activeGoal.category === "endurance" && "Endurance"}
                                                            {activeGoal.category === "mobility" && "Mobility"}
                                                            {activeGoal.category === "skill" && "Skill"}
                                                        </span>
                                                    </div>
                                                    {activeGoal.category === "body_composition" && activeGoal.direction && (
                                                        <p className="text-lg font-semibold text-[#E6EAF0] mb-1">
                                                            {activeGoal.direction.charAt(0).toUpperCase() + activeGoal.direction.slice(1)}
                                                            {activeGoal.value && activeGoal.unit && ` ${activeGoal.value} ${activeGoal.unit}`}
                                                        </p>
                                                    )}
                                                    {activeGoal.category === "strength" && activeGoal.target?.exercise && (
                                                        <>
                                                            <p className="text-lg font-semibold text-[#E6EAF0] mb-1">
                                                                {activeGoal.target.exercise}
                                                            </p>
                                                            {activeGoal.target.metric && (
                                                                <p className="text-sm text-[#9AA3B2]">
                                                                    Target: {activeGoal.value || "—"} {activeGoal.unit || activeGoal.target.metric}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                    {activeGoal.category === "endurance" && activeGoal.target?.movement && (
                                                        <>
                                                            <p className="text-lg font-semibold text-[#E6EAF0] mb-1">
                                                                {activeGoal.target.movement}
                                                            </p>
                                                            {activeGoal.target.metric && (
                                                                <p className="text-sm text-[#9AA3B2]">
                                                                    Target: {activeGoal.value || "—"} {activeGoal.unit || activeGoal.target.metric}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                    {activeGoal.category === "mobility" && activeGoal.target?.movement && (
                                                        <>
                                                            <p className="text-lg font-semibold text-[#E6EAF0] mb-1">
                                                                {activeGoal.target.movement}
                                                            </p>
                                                            {activeGoal.value && activeGoal.unit && (
                                                                <p className="text-sm text-[#9AA3B2]">
                                                                    Target: {activeGoal.value} {activeGoal.unit}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                    {activeGoal.category === "skill" && activeGoal.target?.movement && (
                                                        <p className="text-lg font-semibold text-[#E6EAF0]">
                                                            {activeGoal.target.movement}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-[#6B7280] text-center">
                                            This is what you're working toward right now
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <TargetIcon className="h-12 w-12 mx-auto mb-3 text-[#6B7280] opacity-50" />
                                        <p className="text-sm text-[#9AA3B2] mb-1">No active goal</p>
                                        <p className="text-xs text-[#6B7280] mb-4">Set a goal to track your progress</p>
                                        <Link href="/profile">
                                            <Button variant="outline" size="sm">
                                                <PlusIcon className="h-4 w-4 mr-1" />
                                                Create Goal
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Daily Meals Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="lg:col-span-6"
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-3 text-xl text-[#E6EAF0]">
                                        <div className="p-2 bg-[#161B22] rounded-xl">
                                            <AppleIcon className="h-5 w-5 text-[#C7F000]" />
                                        </div>
                                        Daily Meals
                                    </CardTitle>
                                    <Link href="/meals">
                                        <button className="size-8 rounded-full bg-[#161B22] flex items-center justify-center text-[#9AA3B2] hover:text-[#E6EAF0] hover:bg-[#1B212B] transition-all">
                                            <ArrowUpRightIcon size={16} />
                                        </button>
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {/* Calories Progress */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-[#9AA3B2]">Calories</span>
                                            <span className="text-lg font-semibold text-[#E6EAF0]">
                                                {totalCalories} / {targetCalories}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-[#161B22] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#C7F000] rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, ((totalCalories / targetCalories) * 100))}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Planned Meals */}
                                    {plannedMeals.length > 0 && (
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-semibold text-[#E6EAF0]">Planned Meals</h3>
                                            {plannedMeals.map((meal, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-3 rounded-xl bg-[#1B212B]"
                                                >
                                                    <div>
                                                        <div className="text-sm font-medium text-[#E6EAF0] capitalize">{meal.mealType}</div>
                                                        <div className="text-xs text-[#9AA3B2]">{meal.name} • {meal.calories} cal</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Logged Meals */}
                                    {todayMealLogs && todayMealLogs.length > 0 && (
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-semibold text-[#E6EAF0]">Logged Meals</h3>
                                            {todayMealLogs.map((log) => (
                                                <div
                                                    key={log._id}
                                                    className="flex items-center justify-between p-3 rounded-xl bg-[#1B212B]"
                                                >
                                                    <div>
                                                        <div className="text-sm font-medium text-[#E6EAF0]">{log.name}</div>
                                                        <div className="text-xs text-[#9AA3B2]">
                                                            {log.calories} cal{log.protein ? ` • ${log.protein}g protein` : ""}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Quick Add Meal */}
                                    <div className="pt-2 border-t border-[#1B212B]">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Meal name"
                                                value={newMealLog.name}
                                                onChange={(e) => setNewMealLog({ ...newMealLog, name: e.target.value })}
                                                className="flex-1 px-3 py-2 bg-[#161B22] text-[#E6EAF0] placeholder:text-[#6B7280] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C7F000]/20 transition-all"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Cal"
                                                value={newMealLog.calories}
                                                onChange={(e) => setNewMealLog({ ...newMealLog, calories: e.target.value })}
                                                className="w-20 px-3 py-2 bg-[#161B22] text-[#E6EAF0] placeholder:text-[#6B7280] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C7F000]/20 transition-all"
                                            />
                                            <Button
                                                onClick={handleAddMealLog}
                                                size="sm"
                                                className="rounded-full"
                                            >
                                                <PlusIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Chat Card - Under Meals */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                        className="lg:col-span-6"
                    >
                        <Card className="flex flex-col" style={{ maxHeight: "550px" }}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 text-xl text-[#E6EAF0]">
                                    <div className="p-2 bg-[#161B22] rounded-xl">
                                        <MessageSquareIcon className="h-5 w-5 text-[#C7F000]" />
                                    </div>
                                    Chat with Coach
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col min-h-0" style={{ maxHeight: "470px" }}>
                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2" style={{ maxHeight: "390px" }}>
                                    {chatMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "max-w-[85%] rounded-2xl p-3",
                                                msg.role === "user"
                                                    ? "bg-[#C7F000]/20 text-[#E6EAF0] ml-auto border border-[#C7F000]/30"
                                                    : "bg-[#1B212B] text-[#E6EAF0]"
                                            )}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                    ))}
                                    {chatLoading && (
                                        <div className="bg-[#1B212B] rounded-2xl p-3 max-w-[85%]">
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1">
                                                    <div className="w-2 h-2 bg-[#C7F000] rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                                                    <div className="w-2 h-2 bg-[#C7F000] rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                                                    <div className="w-2 h-2 bg-[#C7F000] rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                                                </div>
                                                <span className="text-xs text-[#9AA3B2]">Thinking...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="flex gap-2 pt-2 border-t border-[#1B212B]">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                                        placeholder="Ask me anything..."
                                        className="flex-1 px-4 py-2 bg-[#1B212B] text-[#E6EAF0] placeholder:text-[#6B7280] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#C7F000]/20 transition-all"
                                        disabled={chatLoading}
                                    />
                                    <Button
                                        onClick={handleChatSend}
                                        disabled={chatLoading || !chatInput.trim()}
                                        size="sm"
                                        className="rounded-full"
                                    >
                                        <SendIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Today's Plan Explanation Panel - Full Width */}
                    {todayWorkout && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.55 }}
                            className="lg:col-span-12"
                        >
                            <Card className="h-full">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-3 text-xl text-[#E6EAF0]">
                                            <div className="p-2 bg-gradient-to-br from-[#C7F000]/20 to-[#C7F000]/10 rounded-xl">
                                                <TargetIcon className="h-5 w-5 text-[#C7F000]" />
                                            </div>
                                            Today's Plan
                                        </CardTitle>
                                        {(!todayWorkout.workoutExplanation || (!todayWorkout.mealExplanation && !todayMeals?.[0]?.mealExplanation)) && (
                                            <Button
                                                onClick={handleDeleteTodayWorkout}
                                                size="sm"
                                                variant="outline"
                                                className="text-[#9AA3B2] hover:text-[#C7F000]"
                                            >
                                                Regenerate with Explanations
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {todayWorkout.workoutExplanation ? (
                                            <div className="p-5 rounded-xl bg-[#1B212B] border border-[#C7F000]/20">
                                                <div className="flex items-start gap-3 mb-2">
                                                    <DumbbellIcon className="h-5 w-5 text-[#C7F000] flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <h3 className="text-sm font-semibold text-[#C7F000] mb-2 uppercase tracking-wide">
                                                            Workout Strategy
                                                        </h3>
                                                        <p className="text-sm text-[#E6EAF0] leading-relaxed">
                                                            {todayWorkout.workoutExplanation}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-5 rounded-xl bg-[#1B212B] border border-[#6B7280]/20">
                                                <div className="flex items-start gap-3 mb-2">
                                                    <DumbbellIcon className="h-5 w-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <h3 className="text-sm font-semibold text-[#6B7280] mb-2 uppercase tracking-wide">
                                                            Workout Strategy
                                                        </h3>
                                                        <p className="text-sm text-[#9AA3B2] leading-relaxed">
                                                            Generate a new workout to see the strategy explanation.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {(todayWorkout.mealExplanation || todayMeals?.[0]?.mealExplanation) ? (
                                            <div className="p-5 rounded-xl bg-[#1B212B] border border-[#C7F000]/20">
                                                <div className="flex items-start gap-3 mb-2">
                                                    <AppleIcon className="h-5 w-5 text-[#C7F000] flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <h3 className="text-sm font-semibold text-[#C7F000] mb-2 uppercase tracking-wide">
                                                            Nutrition Strategy
                                                        </h3>
                                                        <p className="text-sm text-[#E6EAF0] leading-relaxed">
                                                            {todayWorkout.mealExplanation || todayMeals?.[0]?.mealExplanation}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-5 rounded-xl bg-[#1B212B] border border-[#6B7280]/20">
                                                <div className="flex items-start gap-3 mb-2">
                                                    <AppleIcon className="h-5 w-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <h3 className="text-sm font-semibold text-[#6B7280] mb-2 uppercase tracking-wide">
                                                            Nutrition Strategy
                                                        </h3>
                                                        <p className="text-sm text-[#9AA3B2] leading-relaxed">
                                                            Generate a new workout to see the nutrition strategy explanation.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* Today's Workout Card - Large Primary */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="lg:col-span-6"
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-3 text-2xl text-[#E6EAF0]">
                                        <div className="p-2 bg-[#161B22] rounded-xl">
                                            <DumbbellIcon className="h-6 w-6 text-[#C7F000]" />
                                        </div>
                                        Today's Workout
                                    </CardTitle>
                                    {!todayWorkout && (
                                        <Button
                                            onClick={handleGenerateToday}
                                            size="sm"
                                            disabled={generatingWorkout}
                                        >
                                            {generatingWorkout ? "Generating..." : "Generate Today"}
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {todayWorkout ? (
                                    <div className="space-y-4">
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
                                                            "rounded-xl p-5 transition-all duration-200",
                                                            allCompleted
                                                                ? "bg-[#C7F000]/10 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)]"
                                                                : "bg-[#1B212B] shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)] hover:shadow-[0_25px_50px_-20px_rgba(0,0,0,0.8)] hover:-translate-y-0.5"
                                                        )}
                                                    >
                                                        <div className="font-semibold mb-3 flex items-center justify-between">
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <button
                                                                    onClick={toggleCollapse}
                                                                    className="p-1 rounded hover:bg-[#161B22] transition-colors"
                                                                    aria-label={isCollapsed ? "Expand exercise" : "Collapse exercise"}
                                                                >
                                                                    {isCollapsed ? (
                                                                        <ChevronDownIcon className="h-4 w-4 text-[#9AA3B2]" />
                                                                    ) : (
                                                                        <ChevronUpIcon className="h-4 w-4 text-[#9AA3B2]" />
                                                                    )}
                                                                </button>
                                                                <span className="text-base text-[#E6EAF0]">{exercise?.name || "Unknown"}</span>
                                                            </div>
                                                            {allCompleted && (
                                                                <CheckIcon className="h-5 w-5 text-[#C7F000]" />
                                                            )}
                                                        </div>
                                                        {!isCollapsed && (
                                                            <div className="space-y-2.5 text-sm">
                                                                {setsForExercise.map((set: any, setIdx: number) => (
                                                                    <div
                                                                        key={setIdx}
                                                                        className={cn(
                                                                            "flex items-center justify-between py-2",
                                                                            set.completed ? "text-[#C7F000]" : "text-[#9AA3B2]"
                                                                        )}
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
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        <Link href="/workouts">
                                            <Button variant="outline" className="w-full mt-6">
                                                View Full Workout
                                            </Button>
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="text-center py-16 text-[#9AA3B2]">
                                        <p className="mb-2 text-base">No workout scheduled for today.</p>
                                        <p className="text-sm">Rest day or generate a workout above.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>

            {/* Water Bottle Expanded Modal */}
            <AnimatePresence>
                {waterExpanded && convexUser?._id && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#0B0F14]/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setWaterExpanded(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#161B22] rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-semibold text-[#E6EAF0]">Water Tracker</h2>
                                <button
                                    onClick={() => setWaterExpanded(false)}
                                    className="p-2 rounded-lg hover:bg-[#1B212B] text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors"
                                >
                                    <XIcon className="h-6 w-6" />
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
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HomePage;
