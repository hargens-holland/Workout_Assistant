"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import ProfileHeader from "@/components/ProfileHeader";
import NoFitnessPlan from "@/components/NoFitnessPlan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Page } from "@/components/layout/Page";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppleIcon, CalendarIcon, DumbbellIcon, CheckIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
// Split types - defined locally for frontend
type SplitType = "PPL" | "UPPER_LOWER" | "FULL_BODY" | "BRO_SPLIT" | "PUSH_PULL_LEGS_ARMS";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const ProfilePage = () => {
    const { user } = useUser();

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        user?.id ? { clerkId: user.id } : "skip"
    );

    const allPlans = useQuery(
        api.plans.getUserPlans,
        convexUser?._id ? { userId: convexUser._id } : "skip"
    );
    const [selectedPlanId, setSelectedPlanId] = useState<null | string>(null);

    const activePlan = allPlans?.find((plan) => plan.isActive);

    const currentPlan = selectedPlanId
        ? allPlans?.find((plan) => plan._id === selectedPlanId)
        : activePlan;
    
    // Extract user rules from active plan (if available)
    // Note: In a real app, these would be stored in user profile
    // For now, we'll show plan-based info

    const addMeal = useMutation(api.plans.addMealToPlan);
    const changePlanSplit = useAction(api.plans.changePlanSplit);
    const splitTypes = useQuery(api.plans.getSplitTypes);
    const setActivePlan = useMutation(api.plans.setActivePlan);
    const deletePlan = useMutation(api.plans.deletePlan);
    const [showAddMeal, setShowAddMeal] = useState(false);
    const [changingSplit, setChangingSplit] = useState(false);
    const [newMeal, setNewMeal] = useState({
        name: "",
        foods: "",
        calories: 0,
    });

    const handleAddMeal = async () => {
        if (!currentPlan?._id) return;

        const foodsArray = newMeal.foods
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f.length > 0);

        if (!newMeal.name || foodsArray.length === 0 || newMeal.calories <= 0) {
            alert("Please fill in all fields: name, foods (comma-separated), and calories");
            return;
        }

        try {
            await addMeal({
                planId: currentPlan._id,
                meal: {
                    name: newMeal.name,
                    foods: foodsArray,
                    calories: newMeal.calories,
                },
            });
            setNewMeal({ name: "", foods: "", calories: 0 });
            setShowAddMeal(false);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to add meal");
        }
    };

    const handleSetActivePlan = async (planId: string) => {
        if (!convexUser?._id) return;
        try {
            await setActivePlan({
                planId: planId as any,
                userId: convexUser._id,
            });
        } catch (error) {
            console.error("Error setting active plan:", error);
            alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleDeletePlan = async (planId: string) => {
        if (!confirm("Are you sure you want to delete this plan? This will also delete all associated workouts.")) {
            return;
        }
        try {
            await deletePlan({ planId: planId as any });
            // If we deleted the currently selected plan, reset selection
            if (selectedPlanId === planId) {
                setSelectedPlanId(null);
            }
        } catch (error) {
            console.error("Error deleting plan:", error);
            alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    return (
        <Page>
            <ProfileHeader user={user} />

            <div className="max-w-4xl mx-auto space-y-8">
                {/* Rules Section */}
                {activePlan && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Rules & Preferences</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Fitness Goal</div>
                                    <div className="font-semibold">
                                        {activePlan?.trainingStrategy?.goal_type || "Not set"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Primary Focus</div>
                                    <div className="font-semibold">
                                        {activePlan?.trainingStrategy?.primary_focus || "Not set"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Injuries / Limitations</div>
                                    <div className="font-semibold">
                                        {activePlan?.trainingStrategy?.recovery_notes || "None specified"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Dietary Preferences</div>
                                    <div className="font-semibold">
                                        {activePlan?.dietPlan?.meals?.length ? "Custom meal plan active" : "Not set"}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {allPlans && allPlans?.length > 0 ? (
                    <div className="space-y-8">
                        {/* PLAN SELECTOR */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Your Fitness Plans</CardTitle>
                                    <div className="text-xs text-muted-foreground">
                                        TOTAL: {allPlans.length}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {allPlans.map((plan) => (
                                        <Button
                                            key={plan._id}
                                            onClick={() => setSelectedPlanId(plan._id)}
                                            variant={selectedPlanId === plan._id ? "default" : "outline"}
                                            className={cn(
                                                selectedPlanId === plan._id && "bg-primary text-primary-foreground"
                                            )}
                                        >
                                            {plan.name}
                                            {plan.isActive && (
                                                <span className="ml-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0.5 rounded">
                                                    ACTIVE
                                                </span>
                                            )}
                                        </Button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* PLAN DETAILS */}

                        {currentPlan && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                        <CardTitle>
                                            PLAN: <span className="text-primary">{currentPlan.name}</span>
                                        </CardTitle>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!currentPlan.isActive && (
                                            <Button
                                                onClick={() => handleSetActivePlan(currentPlan._id)}
                                                variant="outline"
                                                size="sm"
                                                title="Activate this plan"
                                            >
                                                <CheckIcon className="h-4 w-4 mr-1" />
                                                Activate
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => handleDeletePlan(currentPlan._id)}
                                            variant="outline"
                                            size="sm"
                                            className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                            title="Delete this plan"
                                        >
                                            <Trash2Icon className="h-4 w-4 mr-1" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>

                            <Tabs defaultValue="workout" className="w-full">
                                <TabsList className="mb-6 w-full grid grid-cols-2">
                                    <TabsTrigger value="workout">
                                        <DumbbellIcon className="mr-2 size-4" />
                                        Workout Plan
                                    </TabsTrigger>

                                    <TabsTrigger value="diet">
                                        <AppleIcon className="mr-2 h-4 w-4" />
                                        Diet Plan
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="workout">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon className="h-4 w-4 text-primary" />
                                                <span className="text-sm text-muted-foreground">
                                                    Schedule: {currentPlan.workoutPlan.schedule.join(", ")}
                                                </span>
                                            </div>
                                            {currentPlan.trainingStrategy && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">Split:</span>
                                                    <select
                                                        value={currentPlan.trainingStrategy.split_type || "FULL_BODY"}
                                                        onChange={async (e) => {
                                                            if (!currentPlan?._id || !convexUser?._id || !splitTypes) return;
                                                            const newSplit = e.target.value as SplitType;
                                                            if (newSplit === currentPlan.trainingStrategy?.split_type) return;

                                                            const splitInfo = splitTypes[newSplit as keyof typeof splitTypes];
                                                            if (!splitInfo || !confirm(`Change split to ${splitInfo.name}? This will regenerate all workouts.`)) {
                                                                return;
                                                            }

                                                            setChangingSplit(true);
                                                            try {
                                                                await changePlanSplit({
                                                                    planId: currentPlan._id,
                                                                    userId: convexUser._id,
                                                                    newSplitType: newSplit,
                                                                });
                                                            } catch (error) {
                                                                console.error("Error changing split:", error);
                                                                alert("Failed to change split");
                                                            } finally {
                                                                setChangingSplit(false);
                                                            }
                                                        }}
                                                        disabled={changingSplit || !splitTypes}
                                                        className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    >
                                                        {splitTypes && Object.entries(splitTypes).map(([key, value]) => (
                                                            <option key={key} value={key}>
                                                                {value.name} ({value.daysPerWeek} days/week)
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {changingSplit && (
                                                        <span className="text-xs text-muted-foreground">Regenerating...</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <Accordion type="multiple" className="space-y-3">
                                            {currentPlan?.workoutPlan?.exercises?.map((exerciseDay, index) => (
                                                <AccordionItem
                                                    key={index}
                                                    value={exerciseDay.day}
                                                    className="border rounded-lg overflow-hidden"
                                                >
                                                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                                        <div className="flex justify-between w-full items-center">
                                                            <span className="font-semibold text-primary">{exerciseDay.day}</span>
                                                            <div className="text-xs text-muted-foreground">
                                                                {exerciseDay.routines.length} exercises
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>

                                                    <AccordionContent className="pb-4 px-4">
                                                        <div className="space-y-3 mt-2">
                                                            {exerciseDay.routines.map((routine, routineIndex) => (
                                                                <div
                                                                    key={routineIndex}
                                                                    className="rounded-xl p-4 bg-card/50 shadow-soft"
                                                                >
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <h4 className="font-semibold text-sm">
                                                                            {routine.name}
                                                                        </h4>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
                                                                                {routine.sets} sets
                                                                            </div>
                                                                            <div className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-medium">
                                                                                {routine.reps} reps
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {routine.description && (
                                                                        <p className="text-sm text-muted-foreground mt-1">
                                                                            {routine.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    </div>
                                </TabsContent>

                                <TabsContent value="diet">
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center p-4 rounded-lg bg-muted/30">
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Daily Calorie Target
                                            </span>
                                            <div className="text-xl font-semibold text-primary">
                                                {currentPlan.dietPlan.dailyCalories} kcal
                                            </div>
                                        </div>

                                        <div className="flex justify-end">
                                            <Button
                                                onClick={() => setShowAddMeal(!showAddMeal)}
                                                variant="outline"
                                            >
                                                {showAddMeal ? "Cancel" : "+ Add Meal"}
                                            </Button>
                                        </div>

                                        {showAddMeal && (
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle>Add New Meal</CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Meal name (e.g., Snack)"
                                                        value={newMeal.name}
                                                        onChange={(e) =>
                                                            setNewMeal({ ...newMeal, name: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Foods (comma-separated, e.g., Apple, Almonds)"
                                                        value={newMeal.foods}
                                                        onChange={(e) =>
                                                            setNewMeal({ ...newMeal, foods: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Calories"
                                                        value={newMeal.calories || ""}
                                                        onChange={(e) =>
                                                            setNewMeal({
                                                                ...newMeal,
                                                                calories: parseInt(e.target.value) || 0,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                    <Button
                                                        onClick={handleAddMeal}
                                                        className="w-full bg-primary text-primary-foreground"
                                                    >
                                                        Add Meal
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        )}

                                        <div className="space-y-3">
                                            {currentPlan?.dietPlan?.meals?.map((meal, index) => (
                                                <Card key={index}>
                                                    <CardContent className="pt-6">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                            <h4 className="font-semibold text-primary">{meal.name}</h4>
                                                            <span className="text-xs text-muted-foreground ml-auto">
                                                                {meal.calories} kcal
                                                            </span>
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {meal.foods.map((food, foodIndex) => (
                                                                <li
                                                                    key={foodIndex}
                                                                    className="flex items-center gap-2 text-sm text-muted-foreground"
                                                                >
                                                                    <span className="text-xs text-primary font-medium">
                                                                        {String(foodIndex + 1).padStart(2, "0")}
                                                                    </span>
                                                                    {food}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                            </CardContent>
                        </Card>
                        )}
                    </div>
                ) : (
                    <NoFitnessPlan />
                )}
            </div>
        </Page>
    );
};
export default ProfilePage;
