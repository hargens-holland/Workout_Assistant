"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XIcon, SendIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type Message = {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
};

type GoalChatFormProps = {
    userId: Id<"users">;
    onGoalCreated?: (goalId: Id<"goals">) => void;
    onCancel: () => void;
    isLoading?: boolean;
};

export const GoalChatForm = ({ userId, onGoalCreated, onCancel, isLoading: externalLoading }: GoalChatFormProps) => {
    const createGoalFromChat = useAction(api.goals.createGoalFromChat);

    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hi! Tell me about your fitness goal. For example:\n- \"I want to lose 10 pounds\"\n- \"I want to bench press 225 lbs\"\n- \"I want to run a 5k in under 25 minutes\"\n- \"I want to improve my hip mobility\"\n- \"I want to learn how to do a muscle-up\"",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading || externalLoading) return;

        const userMessage: Message = {
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        const currentInput = input.trim();
        setInput("");
        setLoading(true);

        try {
            const result = await createGoalFromChat({
                userId,
                message: currentInput,
            });

            if (result.goalId) {
                // Goal created successfully
                const assistantMessage: Message = {
                    role: "assistant",
                    content: result.message,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, assistantMessage]);

                // Call the callback after a short delay to show the message
                setTimeout(() => {
                    if (onGoalCreated) {
                        onGoalCreated(result.goalId);
                    }
                }, 1000);
            } else {
                // Error or clarification needed
                const assistantMessage: Message = {
                    role: "assistant",
                    content: result.message,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, assistantMessage]);
            }
        } catch (error) {
            const errorMessage: Message = {
                role: "assistant",
                content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const isProcessing = loading || externalLoading;

    return (
        <Card className="mt-4">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Create Goal</CardTitle>
                    <Button variant="ghost" size="icon-sm" onClick={onCancel} disabled={isProcessing}>
                        <XIcon className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col space-y-4">
                    {/* Messages Container */}
                    <div className="h-64 overflow-y-auto px-2 py-4 bg-[#0B0F14] rounded-lg border border-border">
                        <div className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {messages.map((msg, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-2xl p-3 text-sm ${msg.role === "user"
                                                    ? "bg-[#C7F000]/20 text-[#E6EAF0] border border-[#C7F000]/30"
                                                    : "bg-[#161B22] text-[#E6EAF0]"
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {loading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-[#161B22] rounded-2xl p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 bg-[#C7F000] rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                                                <div className="w-2 h-2 bg-[#C7F000] rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                                                <div className="w-2 h-2 bg-[#C7F000] rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                                            </div>
                                            <span className="text-xs text-[#9AA3B2]">Processing...</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                                placeholder="Describe your fitness goal..."
                                className="w-full px-4 py-3 bg-[#161B22] text-[#E6EAF0] placeholder:text-[#6B7280] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C7F000]/20 border border-border"
                                disabled={isProcessing}
                            />
                        </div>
                        <Button
                            onClick={handleSend}
                            disabled={isProcessing || !input.trim()}
                            size="default"
                            className="rounded-lg"
                        >
                            <SendIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
