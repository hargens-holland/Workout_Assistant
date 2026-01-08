"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

/* =======================
   Types
======================= */

type Stage = "LANDING" | "PROFILE" | "GOAL" | "GOAL_DETAILS" | "CONSTRAINTS" | "REVIEW";

type FitnessGoal = "Lose Fat" | "Gain Muscle" | "Increase Strength" | "Improve Endurance";
type Equipment = "Bodyweight Only" | "Dumbbells" | "Full Gym";

// Goal-specific details
type GoalDetails = {
    // Lose Fat
    targetWeight?: number;
    timeframeWeeks?: number;

    // Gain Muscle
    targetMuscleGain?: number; // in pounds
    timeframeMonths?: number;

    // Increase Strength
    targetLift?: string; // e.g., "Bench Press"
    targetIncrease?: number; // in pounds

    // Improve Endurance
    cardioExercise?: string; // e.g., "5K Run", "10K Run"
    targetTime?: string; // e.g., "25:00", "45:00"
};

export type UserProfile = {
    // Body stats
    age: number;
    height: number;
    weight: number;

    // Goal and constraints
    goal: FitnessGoal;
    goalDetails?: GoalDetails;
    equipment?: Equipment; // Optional for Improve Endurance
    daysPerWeek: number;
    minutesPerSession: number;

    // Optional
    experience?: string;
    dietaryRestrictions?: string;
};

/* =======================
   Template Types (for future implementation)
======================= */

export type WorkoutPlanTemplate = {
    schedule: string[];
    exercises: Array<{
        day: string;
        routine: Array<{
            name: string;
            sets: number;
            reps: number;
            duration?: number;
            description?: string;
        }>;
    }>;
};

export type MealPlanTemplate = {
    dailyCalories: number;
    meals: Array<{
        name: string;
        foods: string[];
        calories: number;
        instructions: string[];
    }>;
};

/* =======================
   Component
======================= */

export default function GenerateProgramPage() {
    const { user } = useUser();

    // Get user from database
    const dbUser = useQuery(
        api.users.getUserByClerkID,
        user?.id ? { clerkID: user.id } : "skip"
    );

    // Get all saved plans for the user
    const savedPlans = useQuery(
        api.plans.getUserPlans,
        dbUser?._id ? { userID: dbUser._id } : "skip"
    );

    const [stage, setStage] = useState<Stage>("LANDING");

    // Profile state
    const [age, setAge] = useState(25);
    const [height, setHeight] = useState(170);
    const [weight, setWeight] = useState(70);

    // Goal and constraints
    const [selectedGoal, setSelectedGoal] = useState<FitnessGoal | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
    const [daysPerWeek, setDaysPerWeek] = useState(4);
    const [minutesPerSession, setMinutesPerSession] = useState(45);

    // Goal-specific details
    const [goalDetails, setGoalDetails] = useState<GoalDetails>({});

    /* =======================
       Build User Profile
    ======================= */

    const buildUserProfile = (): UserProfile | null => {
        if (!selectedGoal) {
            return null;
        }

        // Improve Endurance doesn't need equipment
        if (selectedGoal !== "Improve Endurance" && !selectedEquipment) {
            return null;
        }

        return {
            age,
            height,
            weight,
            goal: selectedGoal,
            goalDetails: Object.keys(goalDetails).length > 0 ? goalDetails : undefined,
            equipment: selectedEquipment || undefined,
            daysPerWeek,
            minutesPerSession,
        };
    };

    const handleGenerate = () => {
        const profile = buildUserProfile();
        if (!profile) return;

        // TODO: Workout generation will be handled by deterministic logic here
        // const workoutPlan = generateWorkoutPlan(profile);

        // TODO: Meal plan generation will be handled by deterministic logic here
        // const mealPlan = generateMealPlan(profile);

        console.log("User Profile:", profile);
        // For now, just log the profile - implementation will come later
    };

    /* =======================
       RENDER
    ======================= */

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
            {/* LANDING */}
            {stage === "LANDING" && (
                <div className="max-w-4xl w-full space-y-6">
                    <Card className="p-8 text-center space-y-4">
                        <h1 className="text-3xl font-bold">Your Fitness Coach</h1>
                        <p className="text-muted-foreground">
                            Personalized workouts and meal plans built exactly for your body,
                            goals, and schedule.
                        </p>
                        <Button size="lg" onClick={() => setStage("PROFILE")}>
                            Create My Program
                        </Button>
                    </Card>

                    {/* Display Saved Plans */}
                    {user && dbUser && savedPlans && savedPlans.length > 0 && (
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-4">📋 Your Saved Plans</h2>
                            <div className="space-y-4">
                                {savedPlans.map((plan: any) => (
                                    <div
                                        key={plan._id}
                                        className="border rounded-lg p-4 bg-muted/30 space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold">{plan.name}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Created: {new Date(plan._creationTime).toLocaleDateString()}
                                                    {plan.isActive && (
                                                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                                            Active
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="font-semibold">Workout Days: </span>
                                                {plan.workoutPlan.schedule.join(", ")}
                                            </div>
                                            <div>
                                                <span className="font-semibold">Daily Calories: </span>
                                                {plan.dietPlan.dailyCalories}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* PROFILE - Body Stats */}
            {stage === "PROFILE" && (
                <Card className="max-w-xl w-full p-6 space-y-6">
                    <h2 className="text-xl font-bold text-center">
                        Your Body Stats
                    </h2>

                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-sm font-medium mb-2 block">Age: {age}</span>
                            <input
                                type="range"
                                min={16}
                                max={80}
                                value={age}
                                onChange={(e) => setAge(Number(e.target.value))}
                                className="w-full"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium mb-2 block">Height: {height} cm</span>
                            <input
                                type="range"
                                min={140}
                                max={210}
                                value={height}
                                onChange={(e) => setHeight(Number(e.target.value))}
                                className="w-full"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium mb-2 block">Weight: {weight} kg</span>
                            <input
                                type="range"
                                min={45}
                                max={140}
                                value={weight}
                                onChange={(e) => setWeight(Number(e.target.value))}
                                className="w-full"
                            />
                        </label>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setStage("LANDING")}>
                            Back
                        </Button>
                        <Button className="flex-1" onClick={() => setStage("GOAL")}>
                            Continue
                        </Button>
                    </div>
                </Card>
            )}

            {/* GOAL SELECTION */}
            {stage === "GOAL" && (
                <Card className="max-w-2xl w-full p-6 space-y-6">
                    <h2 className="text-xl font-bold text-center">
                        What's Your Primary Goal?
                    </h2>
                    <p className="text-center text-muted-foreground text-sm">
                        Select one goal to focus on
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        {(["Lose Fat", "Gain Muscle", "Increase Strength", "Improve Endurance"] as FitnessGoal[]).map((goal) => (
                            <button
                                key={goal}
                                onClick={() => setSelectedGoal(goal)}
                                className={`p-6 rounded-lg border-2 transition-all text-left ${selectedGoal === goal
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50"
                                    }`}
                            >
                                <h3 className="font-semibold text-lg mb-2">{goal}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {goal === "Lose Fat" && "Burn calories and reduce body fat"}
                                    {goal === "Gain Muscle" && "Build muscle mass and size"}
                                    {goal === "Increase Strength" && "Get stronger with progressive overload"}
                                    {goal === "Improve Endurance" && "Build cardiovascular fitness"}
                                </p>
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setStage("PROFILE")}>
                            Back
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={() => setStage("GOAL_DETAILS")}
                            disabled={!selectedGoal}
                        >
                            Continue
                        </Button>
                    </div>
                </Card>
            )}

            {/* GOAL DETAILS - Follow-up questions based on selected goal */}
            {stage === "GOAL_DETAILS" && selectedGoal && (
                <Card className="max-w-xl w-full p-6 space-y-6">
                    <h2 className="text-xl font-bold text-center">
                        Tell Us More About Your Goal
                    </h2>

                    {/* Lose Fat */}
                    {selectedGoal === "Lose Fat" && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    How much weight do you want to lose? (kg)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={goalDetails.targetWeight || ""}
                                    onChange={(e) => setGoalDetails({ ...goalDetails, targetWeight: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="e.g., 10"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    How long do you want to achieve this? (weeks)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[8, 12, 16, 20].map((weeks) => (
                                        <button
                                            key={weeks}
                                            onClick={() => setGoalDetails({ ...goalDetails, timeframeWeeks: weeks })}
                                            className={`p-3 rounded-lg border-2 transition-all ${goalDetails.timeframeWeeks === weeks
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            {weeks} weeks
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Gain Muscle */}
                    {selectedGoal === "Gain Muscle" && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    How much muscle do you want to gain? (pounds)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={goalDetails.targetMuscleGain || ""}
                                    onChange={(e) => setGoalDetails({ ...goalDetails, targetMuscleGain: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="e.g., 15"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    How fast do you want to gain? (months)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[3, 6, 9, 12].map((months) => (
                                        <button
                                            key={months}
                                            onClick={() => setGoalDetails({ ...goalDetails, timeframeMonths: months })}
                                            className={`p-3 rounded-lg border-2 transition-all ${goalDetails.timeframeMonths === months
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            {months} months
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Increase Strength */}
                    {selectedGoal === "Increase Strength" && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-sm font-medium mb-3 block">
                                    Which lift do you want to improve?
                                </label>
                                <div className="grid grid-cols-1 gap-3">
                                    {["Bench Press", "Squat", "Deadlift", "Overhead Press"].map((lift) => (
                                        <button
                                            key={lift}
                                            onClick={() => setGoalDetails({ ...goalDetails, targetLift: lift })}
                                            className={`p-4 rounded-lg border-2 transition-all text-left ${goalDetails.targetLift === lift
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            <span className="font-medium">{lift}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    How much do you want to add? (pounds)
                                </label>
                                <input
                                    type="number"
                                    min={5}
                                    max={200}
                                    step={5}
                                    value={goalDetails.targetIncrease || ""}
                                    onChange={(e) => setGoalDetails({ ...goalDetails, targetIncrease: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="e.g., 20"
                                />
                            </div>
                        </div>
                    )}

                    {/* Improve Endurance */}
                    {selectedGoal === "Improve Endurance" && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-sm font-medium mb-3 block">
                                    What cardio exercise do you want to focus on?
                                </label>
                                <div className="grid grid-cols-1 gap-3">
                                    {["5K Run", "10K Run", "Half Marathon", "Marathon", "Cycling", "Swimming"].map((exercise) => (
                                        <button
                                            key={exercise}
                                            onClick={() => setGoalDetails({ ...goalDetails, cardioExercise: exercise })}
                                            className={`p-4 rounded-lg border-2 transition-all text-left ${goalDetails.cardioExercise === exercise
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            <span className="font-medium">{exercise}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    What's your target time? (MM:SS)
                                </label>
                                <input
                                    type="text"
                                    value={goalDetails.targetTime || ""}
                                    onChange={(e) => setGoalDetails({ ...goalDetails, targetTime: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="e.g., 25:00 or 1:30:00"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Format: MM:SS for shorter distances, H:MM:SS for longer
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setStage("GOAL")}>
                            Back
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={() => setStage("CONSTRAINTS")}
                            disabled={
                                (selectedGoal === "Lose Fat" && (!goalDetails.targetWeight || !goalDetails.timeframeWeeks)) ||
                                (selectedGoal === "Gain Muscle" && (!goalDetails.targetMuscleGain || !goalDetails.timeframeMonths)) ||
                                (selectedGoal === "Increase Strength" && (!goalDetails.targetLift || !goalDetails.targetIncrease)) ||
                                (selectedGoal === "Improve Endurance" && (!goalDetails.cardioExercise || !goalDetails.targetTime))
                            }
                        >
                            Continue
                        </Button>
                    </div>
                </Card>
            )}

            {/* CONSTRAINTS */}
            {stage === "CONSTRAINTS" && (
                <Card className="max-w-xl w-full p-6 space-y-6">
                    <h2 className="text-xl font-bold text-center">
                        Your Training Setup
                    </h2>

                    <div className="space-y-6">
                        {/* Equipment Selection - Skip for Improve Endurance */}
                        {selectedGoal !== "Improve Endurance" && (
                            <div>
                                <label className="text-sm font-medium mb-3 block">Available Equipment</label>
                                <div className="grid grid-cols-1 gap-3">
                                    {(["Bodyweight Only", "Dumbbells", "Full Gym"] as Equipment[]).map((equip) => (
                                        <button
                                            key={equip}
                                            onClick={() => setSelectedEquipment(equip)}
                                            className={`p-4 rounded-lg border-2 transition-all text-left ${selectedEquipment === equip
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:border-primary/50"
                                                }`}
                                        >
                                            <span className="font-medium">{equip}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Days Per Week */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Days Per Week: {daysPerWeek}
                            </label>
                            <input
                                type="range"
                                min={2}
                                max={7}
                                value={daysPerWeek}
                                onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>2</span>
                                <span>7</span>
                            </div>
                        </div>

                        {/* Minutes Per Session */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Minutes Per Session: {minutesPerSession}
                            </label>
                            <input
                                type="range"
                                min={20}
                                max={120}
                                step={5}
                                value={minutesPerSession}
                                onChange={(e) => setMinutesPerSession(Number(e.target.value))}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>20 min</span>
                                <span>120 min</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setStage("GOAL_DETAILS")}>
                            Back
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={() => {
                                setStage("REVIEW");
                                handleGenerate();
                            }}
                            disabled={selectedGoal !== "Improve Endurance" && !selectedEquipment}
                        >
                            Generate Plan
                        </Button>
                    </div>
                </Card>
            )}

            {/* REVIEW - Placeholder for future plan display */}
            {stage === "REVIEW" && (
                <Card className="max-w-2xl w-full p-6 space-y-6">
                    <h2 className="text-xl font-bold text-center">
                        Your Program
                    </h2>

                    <div className="space-y-4">
                        <div className="p-4 bg-muted/30 rounded-lg">
                            <h3 className="font-semibold mb-2">Profile Summary</h3>
                            <pre className="text-xs overflow-auto">
                                {JSON.stringify(buildUserProfile(), null, 2)}
                            </pre>
                        </div>

                        <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                {/* Workout generation will be handled by deterministic logic here */}
                                Workout plan generation coming soon...
                            </p>
                        </div>

                        <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                {/* Meal plan generation will be handled by deterministic logic here */}
                                Meal plan generation coming soon...
                            </p>
                        </div>
                    </div>

                    <Button className="w-full" onClick={() => setStage("LANDING")}>
                        Start Over
                    </Button>
                </Card>
            )}
        </div>
    );
}
