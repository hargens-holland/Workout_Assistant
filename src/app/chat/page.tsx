"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { SendIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Message = {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    dataChanges?: Array<{ type: string; description: string }>;
};

const ChatPage = () => {
    const { user } = useUser();
    const today = new Date().toISOString().split("T")[0];

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const chatCommand = useAction(api.chat.chatCommand);

    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hi! I'm your fitness coach. You can ask me to:\n- Swap exercises (e.g., 'swap squats for something knee-friendly')\n- Make workouts easier (e.g., 'make today easier')\n- Add focus areas (e.g., 'add more arms this week')\n- Get meal suggestions (e.g., 'what should I eat tonight?')\n- Log meals (e.g., 'log chicken salad 450 calories 40 protein')\n- Move workouts (e.g., 'move Friday workout to Saturday')\n- Block items (e.g., 'never show burpees again')",
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
        if (!input.trim() || !convexUser?._id || loading) return;

        const userMessage: Message = {
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            const response = await chatCommand({
                userId: convexUser._id,
                message: input.trim(),
                date: today,
            });

            const assistantMessage: Message = {
                role: "assistant",
                content: response.message,
                timestamp: new Date(),
                dataChanges: response.dataChanges,
            };

            setMessages((prev) => [...prev, assistantMessage]);
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

    if (!convexUser) {
        return (
            <div className="h-full flex items-center justify-center bg-[#0B0F14]">
                <div className="text-center text-[#9AA3B2]">Loading...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#0B0F14]">
            {/* Messages Container - Full Height */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="max-w-4xl mx-auto space-y-6">
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
                                    className={cn(
                                        "max-w-[75%] sm:max-w-[65%] rounded-2xl p-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)]",
                                        msg.role === "user"
                                            ? "bg-[#C7F000]/20 text-[#E6EAF0] border border-[#C7F000]/30"
                                            : "bg-[#161B22] text-[#E6EAF0]"
                                    )}
                                >
                                    {msg.dataChanges && msg.dataChanges.length > 0 ? (
                                        <div className="space-y-3">
                                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                            <div className="mt-3 pt-3 border-t border-[#1B212B]">
                                                <div className="text-xs font-semibold mb-2 text-[#9AA3B2]">Changes made:</div>
                                                <Card className="bg-[#1B212B] border-0 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)]">
                                                    <CardContent className="p-3">
                                                        <ul className="text-xs space-y-1.5">
                                                            {msg.dataChanges.map((change, cIdx) => (
                                                                <li key={cIdx} className="flex items-start gap-2 text-[#E6EAF0]">
                                                                    <span className="text-[#C7F000] mt-0.5">•</span>
                                                                    <span>{change.description}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                    )}
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
                            <div className="bg-[#161B22] rounded-2xl p-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)]">
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-[#C7F000] rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                                        <div className="w-2 h-2 bg-[#C7F000] rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                                        <div className="w-2 h-2 bg-[#C7F000] rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                                    </div>
                                    <span className="text-sm text-[#9AA3B2]">Processing...</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Floating Input - Docked at Bottom */}
            <div className="border-t border-[#161B22] bg-[#0B0F14]/80 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex gap-3 items-end">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                                placeholder="Try: 'Make today easier' or 'Add more chest this week'"
                                className="w-full px-6 py-4 pr-14 bg-[#161B22] text-[#E6EAF0] placeholder:text-[#6B7280] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#C7F000]/20 focus:shadow-[0_0_20px_rgba(199,240,0,0.35)] transition-all shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7)]"
                                disabled={loading}
                            />
                        </div>
                        <Button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            size="lg"
                            className="rounded-full shadow-[0_0_20px_rgba(199,240,0,0.35),0_20px_40px_-20px_rgba(0,0,0,0.7)] hover:shadow-[0_0_30px_rgba(199,240,0,0.35),0_25px_50px_-20px_rgba(0,0,0,0.8)]"
                        >
                            <SendIcon className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(" ");
}

export default ChatPage;
