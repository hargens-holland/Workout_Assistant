"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

/* =======================
   Types
======================= */

type ConversationNode =
    | "INTRO"
    | "AGE"
    | "HEIGHT"
    | "WEIGHT"
    | "FITNESS_GOAL"
    | "EXPERIENCE_LEVEL"
    | "WORKOUT_FREQUENCY"
    | "WORKOUT_SPLIT"
    | "INJURIES"
    | "DIETARY_PREFERENCES"
    | "CONFIRMATION"
    | "GENERATING"
    | "COMPLETE";

type Message = {
    role: "assistant" | "user";
    content: string;
    timestamp: Date;
};

type CollectedData = {
    full_name?: string;
    age?: number;
    height?: string;
    weight?: string;
    fitness_goal?: string;
    fitness_level?: string;
    workout_days?: number;
    split_type?: "PPL" | "UPPER_LOWER" | "FULL_BODY";
    injuries?: string;
    dietary_restrictions?: string;
};

/* =======================
   Conversation Messages
======================= */

const CONVERSATION_MESSAGES: Record<ConversationNode, string> = {
    INTRO: "Hello {{full_name}}! I'm going to help you build a personalized workout and nutrition plan.\n\nI'll ask a few quick questions to tailor everything to you.\n\nLet's get started.",
    AGE: "How old are you?",
    HEIGHT: "What is your height? You can say it in feet and inches or centimeters.",
    WEIGHT: "What is your current weight?",
    FITNESS_GOAL: "What is your main fitness goal?\nYou can say things like fat loss, muscle gain, strength, or general fitness.",
    EXPERIENCE_LEVEL: "How would you describe your training experience?\nBeginner, intermediate, or advanced?",
    WORKOUT_FREQUENCY: "How many days per week can you realistically work out?",
    INJURIES: "Do you have any injuries, pain, or movement limitations I should be aware of?",
    DIETARY_PREFERENCES: "Do you have any dietary restrictions or preferences?\nFor example vegetarian, vegan, allergies, or none.",
    CONFIRMATION: "Perfect. I've got everything I need.\n\nI'm going to build your personalized plan now.",
    GENERATING: "Generating your personalized workout and meal plan...",
    COMPLETE: "Your plan has been generated! Check it out below.",
};

/* =======================
   Component
======================= */

export default function GenerateProgramPage() {
    const { user } = useUser();

    // Get user from database
    const dbUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    // Get all saved plans for the user
    const savedPlans = useQuery(
        api.plans.getUserPlans,
        dbUser?._id ? { userId: dbUser._id } : "skip"
    );

    const [currentNode, setCurrentNode] = useState<ConversationNode>("INTRO");
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState("");
    const [collectedData, setCollectedData] = useState<CollectedData>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedPlan, setGeneratedPlan] = useState<any>(null);

    const generatePlanAction = useAction(api.plans.generatePlan);

    const messageContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll messages
    useEffect(() => {
        if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Focus input when new question appears
    useEffect(() => {
        if (currentNode !== "INTRO" && currentNode !== "CONFIRMATION" && currentNode !== "GENERATING" && currentNode !== "COMPLETE") {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [currentNode]);

    // Initialize conversation
    useEffect(() => {
        if (currentNode === "INTRO" && user && messages.length === 0) {
            const fullName = user.firstName
                ? `${user.firstName} ${user.lastName || ""}`.trim()
                : "There";

            setCollectedData({ full_name: fullName });

            const introMessage = CONVERSATION_MESSAGES.INTRO.replace("{{full_name}}", fullName);
            setMessages([{
                role: "assistant",
                content: introMessage,
                timestamp: new Date(),
            }]);
        }
    }, [user, currentNode, messages.length]);

    /* =======================
       Handle User Input
    ======================= */

    const normalizeFitnessGoal = (input: string): string => {
        const lower = input.toLowerCase();
        if (lower.includes("lose") || lower.includes("fat") || lower.includes("weight")) return "fat_loss";
        if (lower.includes("muscle") || lower.includes("gain") || lower.includes("bulk")) return "muscle_gain";
        if (lower.includes("strength") || lower.includes("strong") || lower.includes("power")) return "strength";
        if (lower.includes("endurance") || lower.includes("cardio") || lower.includes("run")) return "endurance";
        return "general_fitness";
    };

    const extractNumber = (input: string): number | null => {
        const match = input.match(/\d+/);
        return match ? parseInt(match[0]) : null;
    };

    const handleSubmit = () => {
        if (!userInput.trim()) return;

        // Add user message
        const userMessage: Message = {
            role: "user",
            content: userInput.trim(),
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);

        // Process based on current node
        let nextNode: ConversationNode;
        const newData = { ...collectedData };

        switch (currentNode) {
            case "AGE":
                const age = extractNumber(userInput);
                if (age) {
                    newData.age = age;
                    nextNode = "HEIGHT";
                } else {
                    // Ask again if invalid
                    setMessages(prev => [...prev, {
                        role: "assistant",
                        content: "Please enter a valid age (e.g., 25).",
                        timestamp: new Date(),
                    }]);
                    setUserInput("");
                    return;
                }
                break;

            case "HEIGHT":
                newData.height = userInput.trim();
                nextNode = "WEIGHT";
                break;

            case "WEIGHT":
                newData.weight = userInput.trim();
                nextNode = "FITNESS_GOAL";
                break;

            case "FITNESS_GOAL":
                newData.fitness_goal = normalizeFitnessGoal(userInput);
                nextNode = "EXPERIENCE_LEVEL";
                break;

            case "EXPERIENCE_LEVEL":
                newData.fitness_level = userInput.trim().toLowerCase();
                nextNode = "WORKOUT_FREQUENCY";
                break;

            case "WORKOUT_FREQUENCY":
                const days = extractNumber(userInput);
                if (days && days >= 1 && days <= 7) {
                    newData.workout_days = days;
                    // Auto-select split based on workout days (no user input needed)
                    // Split will be auto-selected in backend based on workout_days
                    nextNode = "INJURIES";
                } else {
                    setMessages(prev => [...prev, {
                        role: "assistant",
                        content: "Please enter a number between 1 and 7.",
                        timestamp: new Date(),
                    }]);
                    setUserInput("");
                    return;
                }
                break;

            case "INJURIES":
                newData.injuries = userInput.trim() || "None";
                nextNode = "DIETARY_PREFERENCES";
                break;

            case "DIETARY_PREFERENCES":
                newData.dietary_restrictions = userInput.trim() || "None";
                nextNode = "CONFIRMATION";
                break;

            default:
                return;
        }

        setCollectedData(newData);
        setUserInput("");

        // Add assistant response for next question
        if (nextNode !== "CONFIRMATION") {
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: CONVERSATION_MESSAGES[nextNode],
                    timestamp: new Date(),
                }]);
                setCurrentNode(nextNode);
            }, 300);
        } else {
            // Show confirmation and generate plan
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: CONVERSATION_MESSAGES.CONFIRMATION,
                    timestamp: new Date(),
                }]);
                setCurrentNode("GENERATING");
                generatePlan(newData);
            }, 300);
        }
    };

    /* =======================
       Generate Plan with Gemini
    ======================= */

    const generatePlan = async (data: CollectedData) => {
        if (!dbUser?._id) {
            setError("User not found. Please make sure you're logged in.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Call Convex action to generate plan
            const result = await generatePlanAction({
                userId: dbUser._id,
                age: data.age!,
                height: data.height!,
                weight: data.weight!,
                injuries: data.injuries || "None",
                workout_days: data.workout_days!,
                fitness_goal: data.fitness_goal!,
                fitness_level: data.fitness_level!,
                dietary_restrictions: data.dietary_restrictions || "None",
                // split_type is now auto-selected based on workout_days
            });

            if (result.success) {
                setGeneratedPlan(result.data);
                setCurrentNode("COMPLETE");
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: CONVERSATION_MESSAGES.COMPLETE,
                    timestamp: new Date(),
                }]);
            } else {
                throw new Error("Failed to generate plan");
            }
        } catch (err) {
            console.error("Error generating plan:", err);
            setError(err instanceof Error ? err.message : "Failed to generate plan");
            setMessages(prev => [...prev, {
                role: "assistant",
                content: `Sorry, there was an error generating your plan: ${err instanceof Error ? err.message : "Unknown error"}`,
                timestamp: new Date(),
            }]);
        } finally {
            setLoading(false);
        }
    };

    /* =======================
       Start Conversation
    ======================= */

    const startConversation = () => {
        setCurrentNode("AGE");
        setMessages(prev => [...prev, {
            role: "assistant",
            content: CONVERSATION_MESSAGES.AGE,
            timestamp: new Date(),
        }]);
    };

    /* =======================
       RENDER
    ======================= */

    const showInput = currentNode !== "INTRO" &&
        currentNode !== "CONFIRMATION" &&
        currentNode !== "GENERATING" &&
        currentNode !== "COMPLETE";

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
            <div className="max-w-4xl w-full space-y-6">
                {/* Chat Interface */}
                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-4 text-center">
                        Your Fitness Coach
                    </h2>

                    {/* Messages */}
                    <div
                        ref={messageContainerRef}
                        className="h-96 overflow-y-auto border rounded-lg p-4 space-y-4 mb-4 bg-muted/30"
                    >
                        {messages.length === 0 && currentNode === "INTRO" && (
                            <div className="text-center text-muted-foreground py-8">
                                <p>Click "Start Conversation" to begin</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                    }`}>
                                    <div className="text-xs font-semibold mb-1 opacity-70">
                                        {msg.role === "user" ? "You" : "Coach"}
                                    </div>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-muted rounded-lg p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                        <span className="text-sm">Generating your plan...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">
                                <p className="font-semibold">Error:</p>
                                <p>{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    {currentNode === "INTRO" && (
                        <Button className="w-full" onClick={startConversation}>
                            Start Conversation
                        </Button>
                    )}

                    {showInput && (
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                className="flex-1 rounded-lg border px-3 py-2"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                placeholder="Type your answer..."
                                disabled={loading}
                            />
                            <Button onClick={handleSubmit} disabled={loading || !userInput.trim()}>
                                Send
                            </Button>
                        </div>
                    )}

                    {currentNode === "COMPLETE" && generatedPlan && (
                        <div className="mt-4 space-y-4">
                            <div>
                                <h3 className="text-lg font-semibold mb-3">💪 Your Workout Plan</h3>
                                <div className="bg-muted/30 border rounded-lg p-4">
                                    <div className="mb-2">
                                        <span className="font-semibold">Schedule: </span>
                                        {generatedPlan.workoutPlan?.schedule?.join(", ")}
                                    </div>
                                    <div className="space-y-3 mt-4">
                                        {generatedPlan.workoutPlan?.exercises?.map((exercise: any, idx: number) => (
                                            <div key={idx} className="border-l-2 border-primary pl-3">
                                                <h4 className="font-semibold">{exercise.day}</h4>
                                                <ul className="list-disc list-inside space-y-1 mt-1 text-sm">
                                                    {exercise.routines?.map((routine: any, rIdx: number) => (
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
                                        {generatedPlan.dietPlan?.dailyCalories}
                                    </div>
                                    <div className="space-y-2">
                                        {generatedPlan.dietPlan?.meals?.map((meal: any, idx: number) => (
                                            <div key={idx} className="border-l-2 border-green-500 pl-3">
                                                <h4 className="font-semibold">{meal.name}</h4>
                                                <ul className="list-disc list-inside space-y-1 mt-1 text-sm">
                                                    {meal.foods?.map((food: string, fIdx: number) => (
                                                        <li key={fIdx}>{food}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <Button className="w-full" onClick={() => {
                                setCurrentNode("INTRO");
                                setMessages([]);
                                setCollectedData({});
                                setGeneratedPlan(null);
                                setError(null);
                            }}>
                                Start New Conversation
                            </Button>
                        </div>
                    )}
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
        </div>
    );
}
