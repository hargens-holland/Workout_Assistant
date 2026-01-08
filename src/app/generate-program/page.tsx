"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";

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

type UserProfile = {
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
    const [stage, setStage] = useState<Stage>("LANDING");

    const [step, setStep] = useState<IntakeStep>("GOAL");
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [profile, setProfile] = useState<UserProfile>({});

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

    /* =======================
       RENDER
    ======================= */

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            {/* LANDING */}
            {stage === "LANDING" && (
                <Card className="max-w-xl w-full p-8 text-center space-y-4">
                    <h1 className="text-3xl font-bold">Your AI Fitness Coach</h1>
                    <p className="text-muted-foreground">
                        Personalized workouts and meal plans built exactly for your body,
                        goals, and schedule.
                    </p>
                    <Button size="lg" onClick={() => setStage("CHARACTER")}>
                        Generate My Program
                    </Button>
                </Card>
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
                        <pre className="mt-4 text-xs bg-black text-green-400 p-3 rounded">
                            {JSON.stringify(profile, null, 2)}
                        </pre>
                    )}
                </Card>
            )}
        </div>
    );
}
