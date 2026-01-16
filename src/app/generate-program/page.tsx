"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
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

    // Get active goal for the user
    const activeGoal = useQuery(
        api.goals.getActiveGoal,
        dbUser?._id ? { userId: dbUser._id } : "skip"
    );

    const [currentNode, setCurrentNode] = useState<ConversationNode>("INTRO");
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState("");
    const [collectedData, setCollectedData] = useState<CollectedData>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [goalCreated, setGoalCreated] = useState(false);

    const createGoal = useMutation(api.goals.createGoal);
    const updateProfile = useMutation(api.users.updateProfile);

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
            // Show confirmation and create goal
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: CONVERSATION_MESSAGES.CONFIRMATION,
                    timestamp: new Date(),
                }]);
                setCurrentNode("GENERATING");
                createGoalAndProfile(newData);
            }, 300);
        }
    };

    /* =======================
       Create Goal and Update Profile
    ======================= */

    const createGoalAndProfile = async (data: CollectedData) => {
        if (!dbUser?._id) {
            setError("User not found. Please make sure you're logged in.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Helper function to convert height string to cm
            function convertHeightToCm(heightStr: string): number {
                const lower = heightStr.toLowerCase().trim();
                const feetInchesMatch = lower.match(/(\d+)\s*(?:'|ft|feet)\s*(\d+)?/);
                if (feetInchesMatch) {
                    const feet = parseInt(feetInchesMatch[1]);
                    const inches = feetInchesMatch[2] ? parseInt(feetInchesMatch[2]) : 0;
                    return Math.round((feet * 30.48) + (inches * 2.54));
                }
                const cmMatch = lower.match(/(\d+)\s*cm/);
                if (cmMatch) {
                    return parseInt(cmMatch[1]);
                }
                const numbers = lower.match(/\d+/g);
                if (numbers && numbers.length > 0) {
                    const num = parseInt(numbers[0]);
                    if (num > 100) {
                        return num;
                    } else {
                        const inches = numbers[1] ? parseInt(numbers[1]) : 0;
                        return Math.round((num * 30.48) + (inches * 2.54));
                    }
                }
                return 175;
            }

            // Helper function to convert weight string to kg
            function convertWeightToKg(weightStr: string): number {
                const lower = weightStr.toLowerCase().trim();
                const lbsMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/);
                if (lbsMatch) {
                    return Math.round(parseFloat(lbsMatch[1]) * 0.453592);
                }
                const kgMatch = lower.match(/(\d+(?:\.\d+)?)\s*kg/);
                if (kgMatch) {
                    return Math.round(parseFloat(kgMatch[1]));
                }
                const numbers = lower.match(/\d+(?:\.\d+)?/);
                if (numbers) {
                    const num = parseFloat(numbers[0]);
                    if (num > 50) {
                        return Math.round(num);
                    } else {
                        return Math.round(num * 0.453592);
                    }
                }
                return 70;
            }

            // Helper function to normalize experience level
            function normalizeExperienceLevel(level: string): "beginner" | "intermediate" | "advanced" {
                const lower = level.toLowerCase();
                if (lower.includes("beginner") || lower.includes("new") || lower.includes("starting")) {
                    return "beginner";
                }
                if (lower.includes("advanced") || lower.includes("expert") || lower.includes("experienced")) {
                    return "advanced";
                }
                return "intermediate";
            }

            // Helper function to convert fitness goal to goal category
            function fitnessGoalToCategory(fitnessGoal: string): "body_composition" | "strength" | "endurance" | "mobility" | "skill" {
                const lower = fitnessGoal.toLowerCase();
                if (lower.includes("lose") || lower.includes("fat") || lower.includes("weight") || lower.includes("cut")) {
                    return "body_composition";
                }
                if (lower.includes("strength") || lower.includes("strong") || lower.includes("power") || lower.includes("lift")) {
                    return "strength";
                }
                if (lower.includes("endurance") || lower.includes("cardio") || lower.includes("run") || lower.includes("marathon")) {
                    return "endurance";
                }
                if (lower.includes("mobility") || lower.includes("flexibility")) {
                    return "mobility";
                }
                if (lower.includes("skill") || lower.includes("technique")) {
                    return "skill";
                }
                return "body_composition";
            }

            // Auto-select split based on workout days
            function autoSelectSplit(workoutDays: number): "PPL" | "UPPER_LOWER" | "FULL_BODY" | "BRO_SPLIT" | "PUSH_PULL_LEGS_ARMS" {
                if (workoutDays >= 6) {
                    return "PPL";
                } else if (workoutDays === 5) {
                    return "BRO_SPLIT";
                } else if (workoutDays === 4) {
                    return "UPPER_LOWER";
                } else if (workoutDays === 3) {
                    return "FULL_BODY";
                } else {
                    return "FULL_BODY";
                }
            }

            // Convert and save user profile data
            const heightCm = convertHeightToCm(data.height!);
            const weightKg = convertWeightToKg(data.weight!);
            const experienceLevel = normalizeExperienceLevel(data.fitness_level!);
            const splitType = autoSelectSplit(data.workout_days!);
            
            // Parse injuries into array
            const injuryConstraints = data.injuries && data.injuries.toLowerCase() !== "none" && data.injuries.trim() !== ""
                ? [data.injuries.trim()]
                : [];

            // Update user profile
            await updateProfile({
                userId: dbUser._id,
                height_cm: heightCm,
                weight_kg: weightKg,
                experience_level: experienceLevel,
                injury_constraints: injuryConstraints,
                preferences: {
                    preferred_split: splitType,
                    workout_days_per_week: data.workout_days!,
                    dietary_restrictions: data.dietary_restrictions || "None",
                },
            });

            // Create goal based on fitness goal
            const goalCategory = fitnessGoalToCategory(data.fitness_goal!);
            const goalDirection = goalCategory === "body_composition" 
                ? (data.fitness_goal!.toLowerCase().includes("lose") || data.fitness_goal!.toLowerCase().includes("fat") ? "decrease" : "increase")
                : "increase";

            // Create the goal
            await createGoal({
                userId: dbUser._id,
                category: goalCategory,
                direction: goalDirection,
                priority: "high",
            });

            setGoalCreated(true);
            setCurrentNode("COMPLETE");
            setMessages(prev => [...prev, {
                role: "assistant",
                content: CONVERSATION_MESSAGES.COMPLETE,
                timestamp: new Date(),
            }]);
        } catch (err) {
            console.error("Error creating goal:", err);
            setError(err instanceof Error ? err.message : "Failed to create goal");
            setMessages(prev => [...prev, {
                role: "assistant",
                content: `Sorry, there was an error setting up your profile: ${err instanceof Error ? err.message : "Unknown error"}`,
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

                    {currentNode === "COMPLETE" && goalCreated && (
                        <div className="mt-4 space-y-4">
                            <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg">
                                <h3 className="text-lg font-semibold mb-2">✅ Profile Created!</h3>
                                <p className="mb-2">Your profile and goal have been set up successfully.</p>
                                <p className="text-sm">You can now go to the home page to generate today's workout.</p>
                            </div>

                            <Button className="w-full" onClick={() => {
                                window.location.href = "/home";
                            }}>
                                Go to Home
                            </Button>
                        </div>
                    )}
                </Card>

            </div>
        </div>
    );
}
