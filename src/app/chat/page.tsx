"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import CornerElements from "@/components/CornerElements";
import { MessageSquareIcon, SendIcon } from "lucide-react";

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
            <section className="relative z-10 pt-12 pb-32 flex-grow container mx-auto px-4">
                <div className="text-center text-muted-foreground">Loading...</div>
            </section>
        );
    }

    return (
        <section className="relative z-10 pt-12 pb-32 flex-grow container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
                <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                    <CornerElements />
                    <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <MessageSquareIcon className="h-6 w-6 text-primary" />
                        <span className="text-primary">Chat</span> with Coach
                    </h1>

                    {/* Messages */}
                    <div className="h-96 overflow-y-auto border border-border rounded-lg p-4 mb-4 bg-background/50 space-y-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg p-3 ${
                                        msg.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                    }`}
                                >
                                    <div className="text-xs font-semibold mb-1 opacity-70">
                                        {msg.role === "user" ? "You" : "Coach"}
                                    </div>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    {msg.dataChanges && msg.dataChanges.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border/50">
                                            <div className="text-xs font-semibold mb-1">Changes made:</div>
                                            <ul className="text-xs space-y-1">
                                                {msg.dataChanges.map((change, cIdx) => (
                                                    <li key={cIdx}>• {change.description}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-muted rounded-lg p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                        <span className="text-sm">Processing...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                            placeholder="Type your command..."
                            className="flex-1 px-4 py-2 border border-border rounded-lg bg-background"
                            disabled={loading}
                        />
                        <Button onClick={handleSend} disabled={loading || !input.trim()}>
                            <SendIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ChatPage;
