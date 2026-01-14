"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import ProfileHeader from "@/components/ProfileHeader";
import NoFitnessPlan from "@/components/NoFitnessPlan";
import CornerElements from "@/components/CornerElements";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppleIcon, CalendarIcon, DumbbellIcon, CheckIcon, Trash2Icon } from "lucide-react";
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
        <section className="relative z-10 pt-12 pb-32 flex-grow container mx-auto px-4">
            <ProfileHeader user={user} />

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Rules Section */}
                {activePlan && (
                    <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                        <CornerElements />
                        <h2 className="text-xl font-bold mb-4">
                            <span className="text-primary">Rules</span> & Preferences
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Fitness Goal</div>
                                <div className="font-semibold">
                                    {activePlan?.trainingStrategy?.goal_type || "Not set"}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Primary Focus</div>
                                <div className="font-semibold">
                                    {activePlan?.trainingStrategy?.primary_focus || "Not set"}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Injuries / Limitations</div>
                                <div className="font-semibold">
                                    {activePlan?.trainingStrategy?.recovery_notes || "None specified"}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Dietary Preferences</div>
                                <div className="font-semibold">
                                    {activePlan?.dietPlan?.meals?.length ? "Custom meal plan active" : "Not set"}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {allPlans && allPlans?.length > 0 ? (
                    <div className="space-y-8">
                        {/* PLAN SELECTOR */}
                        <div className="relative backdrop-blur-sm border border-border p-6">
                        <CornerElements />
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold tracking-tight">
                                <span className="text-primary">Your</span>{" "}
                                <span className="text-foreground">Fitness Plans</span>
                            </h2>
                            <div className="font-mono text-xs text-muted-foreground">
                                TOTAL: {allPlans.length}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {allPlans.map((plan) => (
                                <Button
                                    key={plan._id}
                                    onClick={() => setSelectedPlanId(plan._id)}
                                    className={`text-foreground border hover:text-white ${selectedPlanId === plan._id
                                        ? "bg-primary/20 text-primary border-primary"
                                        : "bg-transparent border-border hover:border-primary/50"
                                        }`}
                                >
                                    {plan.name}
                                    {plan.isActive && (
                                        <span className="ml-2 bg-green-500/20 text-green-500 text-xs px-2 py-0.5 rounded">
                                            ACTIVE
                                        </span>
                                    )}
                                </Button>
                            ))}
                        </div>
                        </div>

                        {/* PLAN DETAILS */}

                        {currentPlan && (
                        <div className="relative backdrop-blur-sm border border-border rounded-lg p-6">
                            <CornerElements />

                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                    <h3 className="text-lg font-bold">
                                        PLAN: <span className="text-primary">{currentPlan.name}</span>
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!currentPlan.isActive && (
                                        <Button
                                            onClick={() => handleSetActivePlan(currentPlan._id)}
                                            variant="outline"
                                            size="sm"
                                            className="border-primary/50 text-primary hover:bg-primary/10"
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
                                        className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                                        title="Delete this plan"
                                    >
                                        <Trash2Icon className="h-4 w-4 mr-1" />
                                        Delete
                                    </Button>
                                </div>
                            </div>

                            <Tabs defaultValue="workout" className="w-full">
                                <TabsList className="mb-6 w-full grid grid-cols-2 bg-cyber-terminal-bg border">
                                    <TabsTrigger
                                        value="workout"
                                        className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                                    >
                                        <DumbbellIcon className="mr-2 size-4" />
                                        Workout Plan
                                    </TabsTrigger>

                                    <TabsTrigger
                                        value="diet"
                                        className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                                    >
                                        <AppleIcon className="mr-2 h-4 w-4" />
                                        Diet Plan
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="workout">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon className="h-4 w-4 text-primary" />
                                                <span className="font-mono text-sm text-muted-foreground">
                                                    SCHEDULE: {currentPlan.workoutPlan.schedule.join(", ")}
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
                                                        className="px-3 py-1 border border-border rounded bg-background text-sm"
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

                                        <Accordion type="multiple" className="space-y-4">
                                            {currentPlan?.workoutPlan?.exercises?.map((exerciseDay, index) => (
                                                <AccordionItem
                                                    key={index}
                                                    value={exerciseDay.day}
                                                    className="border rounded-lg overflow-hidden"
                                                >
                                                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-primary/10 font-mono">
                                                        <div className="flex justify-between w-full items-center">
                                                            <span className="text-primary">{exerciseDay.day}</span>
                                                            <div className="text-xs text-muted-foreground">
                                                                {exerciseDay.routines.length} EXERCISES
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>

                                                    <AccordionContent className="pb-4 px-4">
                                                        <div className="space-y-3 mt-2">
                                                            {exerciseDay.routines.map((routine, routineIndex) => (
                                                                <div
                                                                    key={routineIndex}
                                                                    className="border border-border rounded p-3 bg-background/50"
                                                                >
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <h4 className="font-semibold text-foreground">
                                                                            {routine.name}
                                                                        </h4>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-mono">
                                                                                {routine.sets} SETS
                                                                            </div>
                                                                            <div className="px-2 py-1 rounded bg-secondary/20 text-secondary text-xs font-mono">
                                                                                {routine.reps} REPS
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
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="font-mono text-sm text-muted-foreground">
                                                DAILY CALORIE TARGET
                                            </span>
                                            <div className="font-mono text-xl text-primary">
                                                {currentPlan.dietPlan.dailyCalories} KCAL
                                            </div>
                                        </div>

                                        <div className="h-px w-full bg-border my-4"></div>

                                        <div className="flex justify-end mb-4">
                                            <Button
                                                onClick={() => setShowAddMeal(!showAddMeal)}
                                                variant="outline"
                                                className="border-primary/50 text-primary hover:bg-primary/10"
                                            >
                                                {showAddMeal ? "Cancel" : "+ Add Meal"}
                                            </Button>
                                        </div>

                                        {showAddMeal && (
                                            <div className="border border-primary/50 rounded-lg p-4 bg-primary/5 mb-4">
                                                <h4 className="font-semibold mb-3">Add New Meal</h4>
                                                <div className="space-y-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Meal name (e.g., Snack)"
                                                        value={newMeal.name}
                                                        onChange={(e) =>
                                                            setNewMeal({ ...newMeal, name: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-border rounded bg-background"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Foods (comma-separated, e.g., Apple, Almonds)"
                                                        value={newMeal.foods}
                                                        onChange={(e) =>
                                                            setNewMeal({ ...newMeal, foods: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-border rounded bg-background"
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
                                                        className="w-full px-3 py-2 border border-border rounded bg-background"
                                                    />
                                                    <Button
                                                        onClick={handleAddMeal}
                                                        className="w-full bg-primary text-primary-foreground"
                                                    >
                                                        Add Meal
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            {currentPlan?.dietPlan?.meals?.map((meal, index) => (
                                                <div
                                                    key={index}
                                                    className="border border-border rounded-lg overflow-hidden p-4"
                                                >
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                        <h4 className="font-mono text-primary">{meal.name}</h4>
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
                                                                <span className="text-xs text-primary font-mono">
                                                                    {String(foodIndex + 1).padStart(2, "0")}
                                                                </span>
                                                                {food}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                        )}
                    </div>
                ) : (
                    <NoFitnessPlan />
                )}
            </div>
        </section>
    );
};
export default ProfilePage;
