"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { ZapIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const Navbar = () => {
    const { isSignedIn, isLoaded } = useUser();
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B0F14]">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* LOGO */}
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="p-1.5 bg-[#161B22] rounded-xl group-hover:bg-[#1B212B] transition-all duration-200">
                            <ZapIcon className="w-4 h-4 text-[#C7F000]" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-[#E6EAF0]">
                            FitSpark
                        </span>
                    </Link>

                    {/* NAVIGATION */}
                    <nav className="flex items-center gap-1">
                        {!isLoaded ? (
                            <div className="w-20 h-8" />
                        ) : isSignedIn ? (
                            <>
                                <Link
                                    href="/home"
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                                        isActive("/home")
                                            ? "bg-[#C7F000]/20 text-[#C7F000]"
                                            : "text-[#9AA3B2] hover:text-[#E6EAF0] hover:bg-[#161B22]/50"
                                    )}
                                >
                                    <span>Dashboard</span>
                                </Link>

                                <Link
                                    href="/workouts"
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                                        isActive("/workouts")
                                            ? "bg-[#C7F000]/20 text-[#C7F000]"
                                            : "text-[#9AA3B2] hover:text-[#E6EAF0] hover:bg-[#161B22]/50"
                                    )}
                                >
                                    <span>Workouts</span>
                                </Link>

                                <Link
                                    href="/meals"
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                                        isActive("/meals")
                                            ? "bg-[#C7F000]/20 text-[#C7F000]"
                                            : "text-[#9AA3B2] hover:text-[#E6EAF0] hover:bg-[#161B22]/50"
                                    )}
                                >
                                    <span>Nutrition</span>
                                </Link>

                                {/* Icons */}
                                <div className="ml-4 flex items-center gap-2">
                                    <Link
                                        href="/profile"
                                        className={cn(
                                            "size-8 rounded-full bg-[#161B22] flex items-center justify-center text-[#9AA3B2] hover:text-[#E6EAF0] hover:bg-[#1B212B] transition-all",
                                            isActive("/profile") && "bg-[#C7F000]/20 text-[#C7F000]"
                                        )}
                                        title="Settings"
                                    >
                                        <SettingsIcon size={16} />
                                    </Link>
                                    <div className="size-8 rounded-full bg-[#161B22] flex items-center justify-center overflow-hidden">
                                        <UserButton />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <SignInButton>
                                    <Button variant="ghost" className="text-[#9AA3B2] hover:text-[#E6EAF0] rounded-xl">
                                        Sign In
                                    </Button>
                                </SignInButton>

                                <SignUpButton>
                                    <Button className="rounded-full">
                                        Sign Up
                                    </Button>
                                </SignUpButton>
                            </>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
};
export default Navbar;
