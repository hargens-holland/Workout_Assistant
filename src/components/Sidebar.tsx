"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { ZapIcon, SettingsIcon, HomeIcon, CalendarIcon, AppleIcon, TargetIcon, UserIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

const Sidebar = ({ onClose }: { onClose?: () => void }) => {
    const { isSignedIn, isLoaded, user } = useUser();
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    const mainMenuItems = [
        { href: "/home", label: "Dashboard", icon: HomeIcon },
        { href: "/workouts", label: "Workouts", icon: CalendarIcon },
        { href: "/meals", label: "Nutrition", icon: AppleIcon },
        { href: "/profile", label: "Profile", icon: UserIcon },
    ];

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#161B22] border-r border-[#1B212B] z-40 flex flex-col hidden lg:flex">
            {/* Logo */}
            <div className="p-6 border-b border-[#1B212B] flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2.5 group" onClick={onClose}>
                    <div className="p-1.5 bg-[#1B212B] rounded-xl group-hover:bg-[#252B35] transition-all duration-200">
                        <ZapIcon className="w-4 h-4 text-[#C7F000]" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-white">
                        FitSpark
                    </span>
                </Link>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 text-white/70 hover:text-white transition-colors"
                    >
                        <XIcon size={20} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4">
                {!isLoaded ? (
                    <div className="space-y-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-10 bg-[#1B212B] rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : isSignedIn ? (
                    <>
                        {/* MAIN MENU */}
                        <div className="mb-6">
                            <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3 px-3">
                                MAIN MENU
                            </div>
                            <div className="space-y-1">
                                {mainMenuItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={onClose}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                                isActive(item.href)
                                                    ? "bg-[#C7F000]/20 text-[#C7F000]"
                                                    : "text-white/70 hover:text-white hover:bg-[#1B212B]"
                                            )}
                                        >
                                            <Icon size={18} />
                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-3 px-3">
                        <SignInButton>
                            <Button variant="ghost" className="w-full text-[#9AA3B2] hover:text-[#E6EAF0] justify-start">
                                Sign In
                            </Button>
                        </SignInButton>
                        <SignUpButton>
                            <Button className="w-full rounded-lg">
                                Sign Up
                            </Button>
                        </SignUpButton>
                    </div>
                )}
            </nav>

            {/* User Section */}
            {isSignedIn && isLoaded && (
                <div className="p-4 border-t border-[#1B212B]">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="size-8 rounded-full bg-[#1B212B] flex items-center justify-center overflow-hidden">
                            <UserButton />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                                {user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "User"}
                            </div>
                            <div className="text-xs text-white/60 truncate">
                                {user?.emailAddresses[0]?.emailAddress}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
