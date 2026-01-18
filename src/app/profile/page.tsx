"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProfileHeader from "@/components/ProfileHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/Page";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppleIcon, CalendarIcon, DumbbellIcon, CheckIcon, Trash2Icon, PlusIcon, PencilIcon, TargetIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
// Split types - defined locally for frontend
type SplitType = "PPL" | "UPPER_LOWER" | "FULL_BODY" | "BRO_SPLIT" | "PUSH_PULL_LEGS_ARMS";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { type Goal } from "@/components/GoalForm";
import { GoalChatForm } from "@/components/GoalChatForm";


const ProfilePage = () => {
    const { user } = useUser();
    const router = useRouter();

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    // Plans are deprecated - removed all plan-related queries and mutations

    // Goals queries and mutations
    const allGoals = useQuery(
        api.goals.getUserGoals,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );
    const activeGoal = useQuery(
        api.goals.getActiveGoal,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );
    const createGoal = useAction(api.goals.createGoal);
    const deleteGoal = useMutation(api.goals.deleteGoal);
    const setActiveGoal = useMutation(api.goals.setActiveGoal);

    const [showGoalForm, setShowGoalForm] = useState(false);
    const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
    const updateProfile = useMutation(api.users.updateProfile);

    // Profile edit state
    const [profileData, setProfileData] = useState({
        experience_level: "" as "beginner" | "intermediate" | "advanced" | "",
        workout_days_per_week: "",
        preferred_split: "" as SplitType | "",
        equipment_access: "",
        height_cm: "",
        weight_kg: "",
        injury_constraints: "",
        dietary_restrictions: "",
    });

    // Helper functions for unit conversion
    const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
        const totalInches = cm / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);
        return { feet, inches };
    };

    const feetInchesToCm = (feet: number, inches: number): number => {
        return (feet * 12 + inches) * 2.54;
    };

    const kgToLbs = (kg: number): number => {
        return kg * 2.20462;
    };

    const lbsToKg = (lbs: number): number => {
        return lbs / 2.20462;
    };

    // Plan-related handlers removed - plans are deprecated

    const [isSavingGoal, setIsSavingGoal] = useState(false);


    const handleDeleteGoal = async (goalId: string) => {
        if (!convexUser?._id) return;
        if (!confirm("Are you sure you want to delete this goal?")) return;

        try {
            await deleteGoal({
                goalId: goalId as any,
                userId: convexUser._id,
            });
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to delete goal");
        }
    };

    const handleSetActiveGoal = async (goalId: string) => {
        if (!convexUser?._id) return;
        try {
            await setActiveGoal({
                goalId: goalId as any,
                userId: convexUser._id,
            });
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to set active goal");
        }
    };

    // Initialize profile data when user data loads
    useEffect(() => {
        if (convexUser && !isEditingProfile) {
            setProfileData({
                experience_level: convexUser.experience_level || "",
                workout_days_per_week: convexUser.preferences?.workout_days_per_week?.toString() || "",
                preferred_split: (convexUser.preferences?.preferred_split as SplitType) || "",
                equipment_access: convexUser.equipment_access ? "yes" : "no",
                height_cm: convexUser.height_cm?.toString() || "",
                weight_kg: convexUser.weight_kg?.toString() || "",
                injury_constraints: convexUser.injury_constraints?.join(", ") || "",
                dietary_restrictions: convexUser.preferences?.dietary_restrictions || "",
            });
        }
    }, [convexUser, isEditingProfile]);

    // Helper function to handle unit system toggle
    const handleUnitSystemToggle = (newSystem: "metric" | "imperial") => {
        if (newSystem === unitSystem) return;

        // Convert height
        if (profileData.height_cm) {
            if (unitSystem === "metric" && newSystem === "imperial") {
                // Converting from metric to imperial
                const cm = parseFloat(profileData.height_cm);
                if (!isNaN(cm)) {
                    const { feet, inches } = cmToFeetInches(cm);
                    setProfileData(prev => ({
                        ...prev,
                        height_cm: `${feet}'${inches}"`,
                    }));
                }
            } else if (unitSystem === "imperial" && newSystem === "metric") {
                // Converting from imperial to metric
                const heightMatch = profileData.height_cm.match(/(\d+)'(\d+)"/);
                if (heightMatch) {
                    const feet = parseInt(heightMatch[1]);
                    const inches = parseInt(heightMatch[2]);
                    const cm = feetInchesToCm(feet, inches);
                    setProfileData(prev => ({
                        ...prev,
                        height_cm: cm.toFixed(1),
                    }));
                }
            }
        }

        // Convert weight
        if (profileData.weight_kg) {
            if (unitSystem === "metric" && newSystem === "imperial") {
                // Converting from metric to imperial
                const kg = parseFloat(profileData.weight_kg);
                if (!isNaN(kg)) {
                    const lbs = kgToLbs(kg);
                    setProfileData(prev => ({
                        ...prev,
                        weight_kg: lbs.toFixed(1),
                    }));
                }
            } else if (unitSystem === "imperial" && newSystem === "metric") {
                // Converting from imperial to metric
                const lbs = parseFloat(profileData.weight_kg);
                if (!isNaN(lbs)) {
                    const kg = lbsToKg(lbs);
                    setProfileData(prev => ({
                        ...prev,
                        weight_kg: kg.toFixed(1),
                    }));
                }
            }
        }

        setUnitSystem(newSystem);
    };

    const handleStartEditProfile = () => {
        if (convexUser) {
            // Reset to metric when starting to edit
            setUnitSystem("metric");
            setProfileData({
                experience_level: convexUser.experience_level || "",
                workout_days_per_week: convexUser.preferences?.workout_days_per_week?.toString() || "",
                preferred_split: (convexUser.preferences?.preferred_split as SplitType) || "",
                equipment_access: convexUser.equipment_access ? "yes" : "no",
                height_cm: convexUser.height_cm?.toString() || "",
                weight_kg: convexUser.weight_kg?.toString() || "",
                injury_constraints: convexUser.injury_constraints?.join(", ") || "",
                dietary_restrictions: convexUser.preferences?.dietary_restrictions || "",
            });
            setIsEditingProfile(true);
        }
    };

    const handleCancelEditProfile = () => {
        setIsEditingProfile(false);
    };

    const handleSaveProfile = async () => {
        if (!convexUser?._id) return;

        try {
            const updates: any = {
                userId: convexUser._id,
            };

            // Update experience level
            if (profileData.experience_level) {
                updates.experience_level = profileData.experience_level;
            }

            // Update height and weight (convert from imperial if needed)
            if (profileData.height_cm) {
                if (unitSystem === "imperial") {
                    // Parse feet'inches" format (e.g., "5'10"")
                    const heightMatch = profileData.height_cm.match(/(\d+)'(\d+)"/);
                    if (heightMatch) {
                        const feet = parseInt(heightMatch[1]);
                        const inches = parseInt(heightMatch[2]);
                        updates.height_cm = feetInchesToCm(feet, inches);
                    }
                } else {
                    updates.height_cm = parseFloat(profileData.height_cm);
                }
            }
            if (profileData.weight_kg) {
                if (unitSystem === "imperial") {
                    // Convert lbs to kg
                    const lbs = parseFloat(profileData.weight_kg);
                    updates.weight_kg = lbsToKg(lbs);
                } else {
                    updates.weight_kg = parseFloat(profileData.weight_kg);
                }
            }

            // Update equipment access
            updates.equipment_access = profileData.equipment_access === "yes";

            // Update preferences
            const preferences: any = {
                ...(convexUser.preferences || {}),
            };

            if (profileData.workout_days_per_week) {
                preferences.workout_days_per_week = parseInt(profileData.workout_days_per_week);
            }

            if (profileData.preferred_split) {
                preferences.preferred_split = profileData.preferred_split;
            }

            if (profileData.dietary_restrictions) {
                preferences.dietary_restrictions = profileData.dietary_restrictions;
            }

            updates.preferences = preferences;

            // Update injury constraints
            if (profileData.injury_constraints) {
                updates.injury_constraints = profileData.injury_constraints
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);
            } else {
                updates.injury_constraints = [];
            }

            await updateProfile(updates);
            setIsEditingProfile(false);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to update profile");
        }
    };

    const splitOptions: { value: SplitType; label: string }[] = [
        { value: "PPL", label: "Push/Pull/Legs" },
        { value: "UPPER_LOWER", label: "Upper/Lower" },
        { value: "FULL_BODY", label: "Full Body" },
        { value: "BRO_SPLIT", label: "Bro Split" },
        { value: "PUSH_PULL_LEGS_ARMS", label: "Push/Pull/Legs/Arms" },
    ];


    return (
        <Page>
            <ProfileHeader user={user} />

            <div className="max-w-4xl mx-auto space-y-8">
                {/* User Profile Section */}
                {convexUser && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Profile & Preferences</CardTitle>
                                {!isEditingProfile ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleStartEditProfile}
                                    >
                                        <PencilIcon className="h-4 w-4 mr-1" />
                                        Edit
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCancelEditProfile}
                                        >
                                            <XIcon className="h-4 w-4 mr-1" />
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveProfile}
                                        >
                                            <CheckIcon className="h-4 w-4 mr-1" />
                                            Save
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Experience Level</div>
                                    {isEditingProfile ? (
                                        <select
                                            value={profileData.experience_level}
                                            onChange={(e) => setProfileData({ ...profileData, experience_level: e.target.value as any })}
                                            className="w-full px-3 py-2 border rounded-lg bg-background"
                                        >
                                            <option value="">Select experience level</option>
                                            <option value="beginner">Beginner</option>
                                            <option value="intermediate">Intermediate</option>
                                            <option value="advanced">Advanced</option>
                                        </select>
                                    ) : (
                                        <div className="font-semibold">
                                            {convexUser.experience_level ? convexUser.experience_level.charAt(0).toUpperCase() + convexUser.experience_level.slice(1) : "Not set"}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-sm font-medium text-muted-foreground">
                                            Height {unitSystem === "metric" ? "(cm)" : "(ft'in\")"}
                                        </div>
                                        {isEditingProfile && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUnitSystemToggle("metric")}
                                                    className={cn(
                                                        "text-xs px-2 py-1 rounded border transition-colors",
                                                        unitSystem === "metric"
                                                            ? "bg-primary text-primary-foreground border-primary"
                                                            : "bg-background text-muted-foreground border-border hover:bg-accent"
                                                    )}
                                                >
                                                    Metric
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUnitSystemToggle("imperial")}
                                                    className={cn(
                                                        "text-xs px-2 py-1 rounded border transition-colors",
                                                        unitSystem === "imperial"
                                                            ? "bg-primary text-primary-foreground border-primary"
                                                            : "bg-background text-muted-foreground border-border hover:bg-accent"
                                                    )}
                                                >
                                                    Imperial
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {isEditingProfile ? (
                                        unitSystem === "metric" ? (
                                            <input
                                                type="number"
                                                value={profileData.height_cm}
                                                onChange={(e) => setProfileData({ ...profileData, height_cm: e.target.value })}
                                                placeholder="Enter height in cm"
                                                className="w-full px-3 py-2 border rounded-lg bg-background"
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={profileData.height_cm}
                                                onChange={(e) => setProfileData({ ...profileData, height_cm: e.target.value })}
                                                placeholder="Enter height as 5'10&quot;"
                                                className="w-full px-3 py-2 border rounded-lg bg-background"
                                            />
                                        )
                                    ) : (
                                        <div className="font-semibold">
                                            {convexUser.height_cm
                                                ? unitSystem === "metric"
                                                    ? `${convexUser.height_cm} cm`
                                                    : (() => {
                                                        const { feet, inches } = cmToFeetInches(convexUser.height_cm!);
                                                        return `${feet}'${inches}"`;
                                                    })()
                                                : "Not set"}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">
                                        Weight {unitSystem === "metric" ? "(kg)" : "(lbs)"}
                                    </div>
                                    {isEditingProfile ? (
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={profileData.weight_kg}
                                            onChange={(e) => setProfileData({ ...profileData, weight_kg: e.target.value })}
                                            placeholder={unitSystem === "metric" ? "Enter weight in kg" : "Enter weight in lbs"}
                                            className="w-full px-3 py-2 border rounded-lg bg-background"
                                        />
                                    ) : (
                                        <div className="font-semibold">
                                            {convexUser.weight_kg
                                                ? unitSystem === "metric"
                                                    ? `${convexUser.weight_kg} kg`
                                                    : `${kgToLbs(convexUser.weight_kg).toFixed(1)} lbs`
                                                : "Not set"}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Equipment Access</div>
                                    {isEditingProfile ? (
                                        <select
                                            value={profileData.equipment_access}
                                            onChange={(e) => setProfileData({ ...profileData, equipment_access: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg bg-background"
                                        >
                                            <option value="no">No Equipment (Bodyweight Only)</option>
                                            <option value="yes">Has Equipment (Gym/Home Gym)</option>
                                        </select>
                                    ) : (
                                        <div className="font-semibold">
                                            {convexUser.equipment_access ? "Has Equipment (Gym/Home Gym)" : "No Equipment (Bodyweight Only)"}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Workout Days Per Week</div>
                                    {isEditingProfile ? (
                                        <select
                                            value={profileData.workout_days_per_week}
                                            onChange={(e) => setProfileData({ ...profileData, workout_days_per_week: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg bg-background"
                                        >
                                            <option value="">Select days</option>
                                            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                                                <option key={num} value={num.toString()}>
                                                    {num} {num === 1 ? "day" : "days"}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="font-semibold">
                                            {convexUser.preferences?.workout_days_per_week || "Not set"}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Preferred Split</div>
                                    {isEditingProfile ? (
                                        <select
                                            value={profileData.preferred_split}
                                            onChange={(e) => setProfileData({ ...profileData, preferred_split: e.target.value as SplitType })}
                                            className="w-full px-3 py-2 border rounded-lg bg-background"
                                        >
                                            <option value="">Select split</option>
                                            {splitOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="font-semibold">
                                            {convexUser.preferences?.preferred_split
                                                ? splitOptions.find((o) => o.value === convexUser.preferences?.preferred_split)?.label || convexUser.preferences?.preferred_split
                                                : "Not set"}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Injuries / Limitations</div>
                                    {isEditingProfile ? (
                                        <input
                                            type="text"
                                            value={profileData.injury_constraints}
                                            onChange={(e) => setProfileData({ ...profileData, injury_constraints: e.target.value })}
                                            placeholder="Enter injuries or limitations (comma-separated)"
                                            className="w-full px-3 py-2 border rounded-lg bg-background"
                                        />
                                    ) : (
                                        <div className="font-semibold">
                                            {convexUser.injury_constraints?.join(", ") || "None"}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Dietary Preferences</div>
                                    {isEditingProfile ? (
                                        <input
                                            type="text"
                                            value={profileData.dietary_restrictions}
                                            onChange={(e) => setProfileData({ ...profileData, dietary_restrictions: e.target.value })}
                                            placeholder="Enter dietary restrictions or preferences"
                                            className="w-full px-3 py-2 border rounded-lg bg-background"
                                        />
                                    ) : (
                                        <div className="font-semibold">
                                            {convexUser.preferences?.dietary_restrictions || "None"}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Goals Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <TargetIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle>Goals</CardTitle>
                                    {allGoals && allGoals.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {allGoals.length} {allGoals.length === 1 ? "goal" : "goals"} • {activeGoal ? "1 active" : "none active"}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {!showGoalForm && (
                                <Button
                                    onClick={() => {
                                        setShowGoalForm(true);
                                    }}
                                    variant="outline"
                                    size="sm"
                                >
                                    <PlusIcon className="h-4 w-4 mr-1" />
                                    Add Goal
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {showGoalForm ? (
                            // Creating new goal - use chat
                            convexUser?._id ? (
                                <GoalChatForm
                                    userId={convexUser._id}
                                    onGoalCreated={(goalId) => {
                                        setShowGoalForm(false);
                                        // Stay on profile page after creating goal
                                    }}
                                    onCancel={() => {
                                        setShowGoalForm(false);
                                    }}
                                    isLoading={isSavingGoal}
                                />
                            ) : null
                        ) : (
                            <div className="space-y-3">
                                {allGoals && allGoals.length > 0 ? (
                                    allGoals.map((goal) => {
                                        const categoryLabels: Record<Goal["category"], string> = {
                                            body_composition: "Body Composition",
                                            strength: "Strength",
                                            endurance: "Endurance",
                                            mobility: "Mobility",
                                            skill: "Skill",
                                        };

                                        const isActive = goal.isActive;
                                        const isExpanded = expandedGoals.has(goal._id);
                                        const hasCoachingPlan = goal.name || goal.summary || goal.reasoning;

                                        const toggleExpand = () => {
                                            const newExpanded = new Set(expandedGoals);
                                            if (isExpanded) {
                                                newExpanded.delete(goal._id);
                                            } else {
                                                newExpanded.add(goal._id);
                                            }
                                            setExpandedGoals(newExpanded);
                                        };

                                        // Get goal display name
                                        const goalName = goal.name || (
                                            goal.category === "body_composition" && goal.direction
                                                ? `${goal.direction.charAt(0).toUpperCase() + goal.direction.slice(1)}${goal.value && goal.unit ? ` ${goal.value} ${goal.unit}` : ""}`
                                                : goal.category === "strength" && goal.target?.exercise
                                                    ? goal.target.exercise
                                                    : goal.category === "endurance" && goal.target?.movement
                                                        ? goal.target.movement
                                                        : goal.category === "mobility" && goal.target?.movement
                                                            ? goal.target.movement
                                                            : goal.category === "skill" && goal.target?.movement
                                                                ? goal.target.movement
                                                                : categoryLabels[goal.category]
                                        );

                                        return (
                                            <div
                                                key={goal._id}
                                                className={cn(
                                                    "group flex flex-col gap-4 p-4 rounded-xl border transition-all",
                                                    isActive
                                                        ? "bg-primary/10 border-primary/30"
                                                        : "bg-card/50 border-border hover:bg-card/70 hover:border-primary/20"
                                                )}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={cn(
                                                        "mt-1 w-2 h-2 rounded-full flex-shrink-0",
                                                        isActive ? "bg-primary" : "bg-muted-foreground"
                                                    )} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className="font-semibold text-[#E6EAF0]">
                                                                {goalName}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {categoryLabels[goal.category]}
                                                            </span>
                                                            {isActive && (
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* Summary (collapsed view) */}
                                                        {goal.summary && (
                                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                                {goal.summary}
                                                            </p>
                                                        )}
                                                        {/* Fallback display for goals without coaching plan */}
                                                        {!hasCoachingPlan && (
                                                            <div className="space-y-1 text-sm text-muted-foreground">
                                                                {goal.category === "body_composition" && goal.direction && (
                                                                    <p className="text-[#E6EAF0]">
                                                                        {goal.direction.charAt(0).toUpperCase() + goal.direction.slice(1)}
                                                                        {goal.value && goal.unit && ` ${goal.value} ${goal.unit}`}
                                                                    </p>
                                                                )}
                                                                {goal.category === "strength" && goal.target?.exercise && (
                                                                    <>
                                                                        {goal.value && goal.unit && (
                                                                            <p className="text-xs">Target: {goal.value} {goal.unit}</p>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {goal.category === "endurance" && goal.target?.movement && (
                                                                    <>
                                                                        {goal.value && goal.unit && (
                                                                            <p className="text-xs">Target: {goal.value} {goal.unit}</p>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {hasCoachingPlan && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                onClick={toggleExpand}
                                                                title={isExpanded ? "Collapse" : "Expand"}
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronUpIcon className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronDownIcon className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        )}
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!isActive && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    onClick={() => handleSetActiveGoal(goal._id)}
                                                                    title="Set as active goal"
                                                                >
                                                                    <CheckIcon className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                onClick={() => handleDeleteGoal(goal._id)}
                                                                title="Delete goal"
                                                                className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                                            >
                                                                <Trash2Icon className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Expanded view with coaching explanation */}
                                                {isExpanded && hasCoachingPlan && (
                                                    <div className="pt-4 border-t border-border/50 space-y-6">
                                                        {/* Goal Reasoning */}
                                                        {goal.reasoning && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-[#E6EAF0] mb-2">Goal Reasoning</h4>
                                                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                                    {goal.reasoning}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {/* Program Overview */}
                                                        {goal.programOverview && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-[#E6EAF0] mb-2">Program Overview</h4>
                                                                <p className="text-sm text-muted-foreground mb-2">
                                                                    <span className="font-medium">Duration:</span> {goal.programOverview.durationWeeks} weeks
                                                                </p>
                                                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                                    {goal.programOverview.highLevelStrategy}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {/* Training Phases */}
                                                        {goal.phases && goal.phases.length > 0 && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-[#E6EAF0] mb-3">Training Phases</h4>
                                                                <div className="space-y-4">
                                                                    {goal.phases.map((phase, idx) => (
                                                                        <div key={idx} className="pl-4 border-l-2 border-primary/20">
                                                                            <div className="flex items-baseline gap-2 mb-1">
                                                                                <h5 className="text-sm font-medium text-[#E6EAF0]">{phase.name}</h5>
                                                                                <span className="text-xs text-muted-foreground">({phase.weeks})</span>
                                                                            </div>
                                                                            {phase.goal && (
                                                                                <p className="text-xs font-medium text-muted-foreground mb-1">{phase.goal}</p>
                                                                            )}
                                                                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                                                {phase.description}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Training Principles */}
                                                        {goal.trainingPrinciples && (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-[#E6EAF0] mb-3">Training Principles</h4>
                                                                <div className="space-y-4">
                                                                    {goal.trainingPrinciples.volumeVsIntensity && (
                                                                        <div>
                                                                            <h5 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Volume vs Intensity</h5>
                                                                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                                                {goal.trainingPrinciples.volumeVsIntensity}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {goal.trainingPrinciples.recoveryAndFatigue && (
                                                                        <div>
                                                                            <h5 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Recovery and Fatigue Management</h5>
                                                                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                                                {goal.trainingPrinciples.recoveryAndFatigue}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {goal.trainingPrinciples.stallAdaptation && (
                                                                        <div>
                                                                            <h5 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Handling Stalls</h5>
                                                                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                                                {goal.trainingPrinciples.stallAdaptation}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <div className="p-4 bg-primary/5 rounded-full w-fit mx-auto mb-4">
                                            <TargetIcon className="h-8 w-8 text-primary/50" />
                                        </div>
                                        <p className="font-medium mb-1">No goals set yet</p>
                                        <p className="text-sm">Add goals to track what you're working toward</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Plans section removed - plans are deprecated, use goals instead */}
            </div>
        </Page>
    );
};
export default ProfilePage;
