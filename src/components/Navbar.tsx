"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { DumbbellIcon, HomeIcon, UserIcon, ZapIcon, CalendarIcon, MessageSquareIcon, AppleIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { usePathname } from "next/navigation";

const Navbar = () => {
    const { isSignedIn } = useUser();
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-md border-b border-border py-3">
            <div className="container mx-auto flex items-center justify-between">
                {/* LOGO */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="p-1 bg-primary/10 rounded">
                        <ZapIcon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xl font-bold font-mono">
                        code<span className="text-primary">flex</span>.ai
                    </span>
                </Link>

                {/* NAVIGATION */}
                <nav className="flex items-center gap-5">
                    {isSignedIn ? (
                        <>
                            <Link
                                href="/home"
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                    isActive("/home") ? "text-primary font-semibold" : "hover:text-primary"
                                }`}
                            >
                                <HomeIcon size={16} />
                                <span>Home</span>
                            </Link>

                            <Link
                                href="/workouts"
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                    isActive("/workouts") ? "text-primary font-semibold" : "hover:text-primary"
                                }`}
                            >
                                <DumbbellIcon size={16} />
                                <span>Workouts</span>
                            </Link>

                            <Link
                                href="/progress"
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                    isActive("/progress") ? "text-primary font-semibold" : "hover:text-primary"
                                }`}
                            >
                                <TrendingUpIcon size={16} />
                                <span>Progress</span>
                            </Link>

                            <Link
                                href="/meals"
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                    isActive("/meals") ? "text-primary font-semibold" : "hover:text-primary"
                                }`}
                            >
                                <AppleIcon size={16} />
                                <span>Meals</span>
                            </Link>

                            <Link
                                href="/calendar"
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                    isActive("/calendar") ? "text-primary font-semibold" : "hover:text-primary"
                                }`}
                            >
                                <CalendarIcon size={16} />
                                <span>Calendar</span>
                            </Link>

                            <Link
                                href="/chat"
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                    isActive("/chat") ? "text-primary font-semibold" : "hover:text-primary"
                                }`}
                            >
                                <MessageSquareIcon size={16} />
                                <span>Chat</span>
                            </Link>

                            <Link
                                href="/profile"
                                className={`flex items-center gap-1.5 text-sm transition-colors ${
                                    isActive("/profile") ? "text-primary font-semibold" : "hover:text-primary"
                                }`}
                            >
                                <UserIcon size={16} />
                                <span>Profile</span>
                            </Link>

                            <UserButton />
                        </>
                    ) : (
                        <>
                            <SignInButton>
                                <Button
                                    variant={"outline"}
                                    className="border-primary/50 text-primary hover:text-white hover:bg-primary/10"
                                >
                                    Sign In
                                </Button>
                            </SignInButton>

                            <SignUpButton>
                                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                                    Sign Up
                                </Button>
                            </SignUpButton>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
};
export default Navbar;
