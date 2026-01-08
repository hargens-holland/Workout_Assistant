"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatAllPrompts } from "./formatPrompts";

/* =======================
   Types
======================= */

type Stage = "LANDING" | "CHARACTER" | "CHAT";

type Message = {
    role: "assistant" | "user";
    content: string;
};

type IntakeStep =
    | "GOAL"
    | "EXPERIENCE"
    | "DAYS"
    | "TIME"
    | "EQUIPMENT"
    | "DIET"
    | "DONE";

export type UserProfile = {
    age?: number;
    height?: number;
    weight?: number;
    goal?: string;
    experience?: string;
    daysPerWeek?: number;
    minutesPerSession?: number;
    equipment?: string;
    diet?: string;
};

/* =======================
   Questions
======================= */

const QUESTIONS: Record<IntakeStep, string> = {
    GOAL: "What is your primary fitness goal?",
    EXPERIENCE: "How would you describe your training experience?",
    DAYS: "How many days per week can you train?",
    TIME: "How many minutes per workout?",
    EQUIPMENT: "What equipment do you have access to?",
    DIET: "Any dietary restrictions or preferences?",
    DONE: "Thanks! Generating your personalized program..."
};

/* =======================
   Component
======================= */

export default function GenerateProgramPage() {
    const { user } = useUser();
    const generatePlan = useAction(api.plans.generatePlan);
    const createPlan = useAction(api.plans.generateAndSavePlan);

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

    const [step, setStep] = useState<IntakeStep>("GOAL");
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [profile, setProfile] = useState<UserProfile>({});
    const [prompts, setPrompts] = useState<{ workoutPrompt: string; mealPlanPrompt: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{ workoutPlan: any; mealPlan: any; planId?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Character builder state
    const [age, setAge] = useState(25);
    const [height, setHeight] = useState(170);
    const [weight, setWeight] = useState(70);

    /* =======================
       Chat Logic
    ======================= */

    const startChat = () => {
        setProfile({ age, height, weight });
        setMessages([{ role: "assistant", content: QUESTIONS.GOAL }]);
        setStage("CHAT");
    };

    const handleSubmit = () => {
        if (!input.trim()) return;

        setMessages((prev) => [...prev, { role: "user", content: input }]);

        const nextProfile = { ...profile };

        switch (step) {
            case "GOAL":
                nextProfile.goal = input;
                setStep("EXPERIENCE");
                break;
            case "EXPERIENCE":
                nextProfile.experience = input;
                setStep("DAYS");
                break;
            case "DAYS":
                nextProfile.daysPerWeek = Number(input);
                setStep("TIME");
                break;
            case "TIME":
                nextProfile.minutesPerSession = Number(input);
                setStep("EQUIPMENT");
                break;
            case "EQUIPMENT":
                nextProfile.equipment = input;
                setStep("DIET");
                break;
            case "DIET":
                nextProfile.diet = input;
                setStep("DONE");
                break;
        }

        setProfile(nextProfile);
        setInput("");

        const nextStep =
            step === "DIET"
                ? "DONE"
                : (Object.keys(QUESTIONS) as IntakeStep[])[
                (Object.keys(QUESTIONS) as IntakeStep[]).indexOf(step) + 1
                ];

        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: QUESTIONS[nextStep] }
            ]);
        }, 400);
    };

    // Generate prompts and call Gemini when step is DONE
    useEffect(() => {
        if (step === "DONE" && profile.goal && profile.experience && !prompts && !loading && !results && dbUser) {
            const formattedPrompts = formatAllPrompts(profile);
            setPrompts(formattedPrompts);

            // Automatically call Gemini API via Convex
            setLoading(true);
            setError(null);

            const planName = `${profile.goal} Plan - ${new Date().toLocaleDateString()}`;

            createPlan({
                workoutPrompt: formattedPrompts.workoutPrompt,
                mealPlanPrompt: formattedPrompts.mealPlanPrompt,
                userID: dbUser._id,
                planName,
            })
                .then((data) => {
                    if (data.success) {
                        setResults({
                            workoutPlan: data.workoutPlan,
                            mealPlan: data.dietPlan,
                            planId: data.planId,
                        });
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: "assistant",
                                content: "✅ Your personalized workout and meal plans have been generated and saved! Check them out below."
                            }
                        ]);
                    } else {
                        setError("Failed to generate plans");
                    }
                })
                .catch((err) => {
                    console.error("Error generating plan:", err);
                    setError(err.message || "Failed to generate plans");
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [step, profile, prompts, loading, results, dbUser, createPlan]);

    /* =======================
       RENDER
    ======================= */

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
            {/* LANDING */}
            {stage === "LANDING" && (
                <div className="max-w-4xl w-full space-y-6">
                    <Card className="p-8 text-center space-y-4">
                        <h1 className="text-3xl font-bold">Your AI Fitness Coach</h1>
                        <p className="text-muted-foreground">
                            Personalized workouts and meal plans built exactly for your body,
                            goals, and schedule.
                        </p>
                        <Button size="lg" onClick={() => setStage("CHARACTER")}>
                            Generate My Program
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
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-sm text-muted-foreground">
                                                View Full Plan
                                            </summary>
                                            <div className="mt-3 space-y-4">
                                                <div>
                                                    <h4 className="font-semibold mb-2">💪 Workout Plan</h4>
                                                    <div className="space-y-2">
                                                        {plan.workoutPlan.exercises.map((exercise: any, idx: number) => (
                                                            <div key={idx} className="border-l-2 border-primary pl-3">
                                                                <h5 className="font-semibold">{exercise.day}</h5>
                                                                <ul className="list-disc list-inside space-y-1 mt-1 text-sm">
                                                                    {exercise.routine.map((routine: any, rIdx: number) => (
                                                                        <li key={rIdx}>
                                                                            {routine.name} - {routine.sets} sets × {routine.reps} reps
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold mb-2">🍽️ Meal Plan</h4>
                                                    <div className="space-y-2">
                                                        {plan.dietPlan.meals.map((meal: any, idx: number) => (
                                                            <div key={idx} className="border-l-2 border-green-500 pl-3">
                                                                <h5 className="font-semibold">{meal.name} ({meal.calories} cal)</h5>
                                                                <ul className="list-disc list-inside space-y-1 mt-1 text-sm">
                                                                    {meal.foods.map((food: string, fIdx: number) => (
                                                                        <li key={fIdx}>{food}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* CHARACTER BUILDER */}
            {stage === "CHARACTER" && (
                <Card className="max-w-xl w-full p-6 space-y-6">
                    <h2 className="text-xl font-bold text-center">
                        Customize Your Body
                    </h2>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <label className="block">
                            Age: {age}
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
                            Height (cm): {height}
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
                            Weight (kg): {weight}
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

                    <Button className="w-full" onClick={startChat}>
                        Continue
                    </Button>
                </Card>
            )}

            {/* CHAT */}
            {stage === "CHAT" && (
                <Card className="max-w-3xl w-full p-6">
                    <h2 className="text-xl font-bold mb-4 text-center">
                        AI Fitness Intake
                    </h2>

                    <div className="h-80 overflow-y-auto border rounded-lg p-4 space-y-3 mb-4 bg-muted/30">
                        {messages.map((m, i) => (
                            <div key={i}>
                                <div className="text-xs font-semibold text-muted-foreground mb-1">
                                    {m.role === "assistant" ? "Coach" : "You"}
                                </div>
                                <p>{m.content}</p>
                            </div>
                        ))}
                    </div>

                    {step !== "DONE" && (
                        <div className="flex gap-2">
                            <input
                                className="flex-1 rounded-lg border px-3 py-2"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            />
                            <Button onClick={handleSubmit}>Send</Button>
                        </div>
                    )}

                    {step === "DONE" && (
                        <div className="mt-4 space-y-4">
                            {loading && (
                                <div className="text-center py-4">
                                    <p className="text-muted-foreground">
                                        🤖 Generating your personalized workout and meal plans...
                                    </p>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">
                                    <p className="font-semibold">Error:</p>
                                    <p>{error}</p>
                                </div>
                            )}

                            {results && (
                                <>
                                    {results.planId && (
                                        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded mb-4">
                                            <p className="font-semibold">✅ Plan Saved Successfully!</p>
                                            <p className="text-sm">Plan ID: {results.planId}</p>
                                            <p className="text-sm">Your plan has been saved to the database and will appear in your saved plans.</p>
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">💪 Your Workout Plan</h3>
                                        <div className="bg-muted/30 border rounded-lg p-4">
                                            <div className="mb-2">
                                                <span className="font-semibold">Schedule: </span>
                                                {results.workoutPlan.schedule?.join(", ")}
                                            </div>
                                            <div className="space-y-3 mt-4">
                                                {results.workoutPlan.exercises?.map((exercise: any, idx: number) => (
                                                    <div key={idx} className="border-l-2 border-primary pl-3">
                                                        <h4 className="font-semibold">{exercise.day}</h4>
                                                        <ul className="list-disc list-inside space-y-1 mt-1">
                                                            {(exercise.routine || exercise.routines)?.map((routine: any, rIdx: number) => (
                                                                <li key={rIdx}>
                                                                    {routine.name} - {routine.sets} sets × {routine.reps} reps
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">🍽️ Your Meal Plan</h3>
                                        <div className="bg-muted/30 border rounded-lg p-4">
                                            <div className="mb-3">
                                                <span className="font-semibold">Daily Calories: </span>
                                                {results.mealPlan.dailyCalories}
                                            </div>
                                            <div className="space-y-2">
                                                {results.mealPlan.meals?.map((meal: any, idx: number) => (
                                                    <div key={idx} className="border-l-2 border-green-500 pl-3">
                                                        <h4 className="font-semibold">{meal.name}</h4>
                                                        <ul className="list-disc list-inside space-y-1 mt-1">
                                                            {meal.foods?.map((food: string, fIdx: number) => (
                                                                <li key={fIdx}>{food}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Show raw JSON for debugging/copying */}
                                    <details className="mt-4">
                                        <summary className="cursor-pointer text-sm text-muted-foreground mb-2">
                                            View Raw JSON
                                        </summary>
                                        <div className="space-y-2">
                                            <div>
                                                <h4 className="text-xs font-semibold mb-1">Workout Plan:</h4>
                                                <pre className="text-xs bg-black text-green-400 p-3 rounded overflow-x-auto">
                                                    {JSON.stringify(results.workoutPlan, null, 2)}
                                                </pre>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-semibold mb-1">Meal Plan:</h4>
                                                <pre className="text-xs bg-black text-green-400 p-3 rounded overflow-x-auto">
                                                    {JSON.stringify(results.mealPlan, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    </details>
                                </>
                            )}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
