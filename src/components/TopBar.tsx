"use client";

import { useUser } from "@clerk/nextjs";
import { BellIcon, MenuIcon } from "lucide-react";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";

const TopBar = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user } = useUser();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    const userName = user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "User";

    return (
        <>
            <header className="h-16 bg-[#161B22] border-b border-[#1B212B] flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden p-2 text-[#9AA3B2] hover:text-[#E6EAF0] transition-colors"
                    >
                        <MenuIcon size={20} />
                    </button>
                    <h1 className="text-lg font-medium text-white">
                        {getGreeting()}, {userName}
                    </h1>
                </div>

            <div className="flex items-center gap-4">
                <div className="text-sm text-white">
                    {formatTime(currentTime)}
                </div>
                <div className="flex items-center gap-3">
                    <button className="relative p-2 text-white hover:text-white/80 transition-colors">
                        <BellIcon size={18} />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-[#C7F000] rounded-full"></span>
                    </button>
                </div>
            </div>
            </header>
            
            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-[#0B0F14]/80 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    <div className="fixed left-0 top-0 bottom-0 w-64 bg-[#161B22] border-r border-[#1B212B] z-50 lg:hidden">
                        <Sidebar onClose={() => setMobileMenuOpen(false)} />
                    </div>
                </>
            )}
        </>
    );
};

export default TopBar;
