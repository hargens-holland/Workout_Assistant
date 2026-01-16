"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import ProfileHeader from "@/components/ProfileHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Page } from "@/components/layout/Page";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppleIcon, CalendarIcon, DumbbellIcon, CheckIcon, Trash2Icon, PlusIcon, PencilIcon, TargetIcon } from "lucide-react";
import { cn } from "@/lib/utils";
// Split types - defined locally for frontend
type SplitType = "PPL" | "UPPER_LOWER" | "FULL_BODY" | "BRO_SPLIT" | "PUSH_PULL_LEGS_ARMS";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { GoalForm, type Goal } from "@/components/GoalForm";

const ProfilePage = () => {
    const { user } = useUser();

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
    const createGoal = useMutation(api.goals.createGoal);
    const updateGoal = useMutation(api.goals.updateGoal);
    const deleteGoal = useMutation(api.goals.deleteGoal);
    const setActiveGoal = useMutation(api.goals.setActiveGoal);
    
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

    // Plan-related handlers removed - plans are deprecated

    const handleSaveGoal = async (goal: Goal) => {
        if (!convexUser?._id) return;

        try {
            if (editingGoalId) {
                // Update existing goal
                await updateGoal({
                    goalId: editingGoalId as any,
                    userId: convexUser._id,
                    category: goal.category,
                    target: goal.target,
                    direction: goal.direction,
                    value: goal.value,
                    unit: goal.unit,
                });
            } else {
                // Create new goal (automatically sets it as active)
                await createGoal({
                    userId: convexUser._id,
                    category: goal.category,
                    target: goal.target,
                    direction: goal.direction,
                    value: goal.value,
                    unit: goal.unit,
                });
            }
            setShowGoalForm(false);
            setEditingGoalId(null);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to save goal");
        }
    };

    const handleEditGoal = (goalId: string) => {
        setEditingGoalId(goalId);
        setShowGoalForm(true);
    };

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


    return (
        <Page>
            <ProfileHeader user={user} />

            <div className="max-w-4xl mx-auto space-y-8">
                {/* User Profile Section */}
                {convexUser && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile & Preferences</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Experience Level</div>
                                    <div className="font-semibold">
                                        {convexUser.experience_level || "Not set"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Workout Days Per Week</div>
                                    <div className="font-semibold">
                                        {convexUser.preferences?.workout_days_per_week || "Not set"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Preferred Split</div>
                                    <div className="font-semibold">
                                        {convexUser.preferences?.preferred_split || "Not set"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Injuries / Limitations</div>
                                    <div className="font-semibold">
                                        {convexUser.injury_constraints?.join(", ") || "None"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Dietary Preferences</div>
                                    <div className="font-semibold">
                                        {convexUser.preferences?.dietary_restrictions || "None"}
                                    </div>
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
                                        setEditingGoalId(null);
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
                            <GoalForm
                                goal={editingGoalId && allGoals ? allGoals.find(g => g._id === editingGoalId) : undefined}
                                onSave={handleSaveGoal}
                                onCancel={() => {
                                    setShowGoalForm(false);
                                    setEditingGoalId(null);
                                }}
                            />
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
                                        
                                        return (
                                            <div
                                                key={goal._id}
                                                className={cn(
                                                    "group flex items-start gap-4 p-4 rounded-xl border transition-all",
                                                    isActive
                                                        ? "bg-primary/10 border-primary/30"
                                                        : "bg-card/50 border-border hover:bg-card/70 hover:border-primary/20"
                                                )}
                                            >
                                                <div className={cn(
                                                    "mt-1 w-2 h-2 rounded-full flex-shrink-0",
                                                    isActive ? "bg-primary" : "bg-muted-foreground"
                                                )} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <span className="font-semibold text-[#E6EAF0]">
                                                            {categoryLabels[goal.category]}
                                                        </span>
                                                        {isActive && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                                                                Active
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1 text-sm text-muted-foreground">
                                                        {goal.category === "body_composition" && (
                                                            <>
                                                                {goal.direction && (
                                                                    <p className="text-[#E6EAF0]">
                                                                        {goal.direction.charAt(0).toUpperCase() + goal.direction.slice(1)}
                                                                        {goal.value && goal.unit && ` ${goal.value} ${goal.unit}`}
                                                                    </p>
                                                                )}
                                                            </>
                                                        )}
                                                        {goal.category === "strength" && goal.target?.exercise && (
                                                            <>
                                                                <p className="text-[#E6EAF0] font-medium">{goal.target.exercise}</p>
                                                                {goal.target.metric && (
                                                                    <p className="text-xs">Metric: {goal.target.metric}</p>
                                                                )}
                                                                {goal.value && goal.unit && (
                                                                    <p className="text-xs">Target: {goal.value} {goal.unit}</p>
                                                                )}
                                                            </>
                                                        )}
                                                        {goal.category === "endurance" && goal.target?.movement && (
                                                            <>
                                                                <p className="text-[#E6EAF0] font-medium">{goal.target.movement}</p>
                                                                {goal.target.metric && (
                                                                    <p className="text-xs">Metric: {goal.target.metric}</p>
                                                                )}
                                                                {goal.value && goal.unit && (
                                                                    <p className="text-xs">Target: {goal.value} {goal.unit}</p>
                                                                )}
                                                            </>
                                                        )}
                                                        {goal.category === "mobility" && goal.target?.movement && (
                                                            <>
                                                                <p className="text-[#E6EAF0] font-medium">{goal.target.movement}</p>
                                                                {goal.value && goal.unit && (
                                                                    <p className="text-xs">Target: {goal.value} {goal.unit}</p>
                                                                )}
                                                            </>
                                                        )}
                                                        {goal.category === "skill" && goal.target?.movement && (
                                                            <p className="text-[#E6EAF0] font-medium">{goal.target.movement}</p>
                                                        )}
                                                    </div>
                                                </div>
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
                                                        onClick={() => handleEditGoal(goal._id)}
                                                        title="Edit goal"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                    </Button>
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
