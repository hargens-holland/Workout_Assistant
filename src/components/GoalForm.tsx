"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Goal = {
    _id?: string;
    category: "body_composition" | "strength" | "endurance" | "mobility" | "skill";
    target?: {
        exercise?: string;
        movement?: string;
        metric?: "weight" | "reps" | "time" | "distance" | "rom";
    };
    direction?: "increase" | "decrease" | "achieve";
    value?: number;
    unit?: string;
    isActive?: boolean;
};

type GoalFormProps = {
    goal?: Goal;
    onSave: (goal: Goal) => void;
    onCancel: () => void;
    isLoading?: boolean;
};

export const GoalForm = ({ goal, onSave, onCancel, isLoading }: GoalFormProps) => {
    const [formData, setFormData] = useState<Partial<Goal>>({
        category: goal?.category || "body_composition",
        target: goal?.target || {},
        direction: goal?.direction,
        value: goal?.value,
        unit: goal?.unit || "",
    });

    useEffect(() => {
        if (goal) {
            setFormData({
                category: goal.category,
                target: goal.target || {},
                direction: goal.direction,
                value: goal.value,
                unit: goal.unit || "",
            });
        }
    }, [goal]);

    const handleCategoryChange = (category: Goal["category"]) => {
        setFormData({
            ...formData,
            category,
            // Reset category-specific fields when category changes
            target: category === "strength" || category === "endurance" || category === "mobility" || category === "skill" 
                ? { ...formData.target } 
                : undefined,
            direction: category === "body_composition" ? formData.direction : undefined,
            metric: undefined,
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!formData.category) {
            alert("Please select a category");
            return;
        }

        // Category-specific validation
        if (formData.category === "body_composition") {
            if (!formData.direction) {
                alert("Please select a direction (increase or decrease)");
                return;
            }
        }

        if (formData.category === "strength") {
            if (!formData.target?.exercise) {
                alert("Please enter an exercise name");
                return;
            }
            if (!formData.target?.metric) {
                alert("Please select a metric (reps or weight)");
                return;
            }
        }

        if (formData.category === "endurance") {
            if (!formData.target?.movement) {
                alert("Please enter a movement name");
                return;
            }
            if (!formData.target?.metric) {
                alert("Please select a metric (time or distance)");
                return;
            }
        }

        if (formData.category === "mobility") {
            if (!formData.target?.movement) {
                alert("Please enter a movement or body part");
                return;
            }
        }

        if (formData.category === "skill") {
            if (!formData.target?.movement) {
                alert("Please enter a movement name");
                return;
            }
        }

        // Build target object only if it has at least one field
        const targetObj: Goal["target"] = {};
        if (formData.target?.exercise) targetObj.exercise = formData.target.exercise;
        if (formData.target?.movement) targetObj.movement = formData.target.movement;
        if (formData.target?.metric) targetObj.metric = formData.target.metric;

        const goalToSave: Goal = {
            category: formData.category,
            ...(Object.keys(targetObj).length > 0 && { target: targetObj }),
            ...(formData.direction && { direction: formData.direction }),
            ...(formData.value !== undefined && formData.value !== null && { value: formData.value }),
            ...(formData.unit && { unit: formData.unit }),
        };

        onSave(goalToSave);
    };

    return (
        <Card className="mt-4">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>{goal ? "Edit Goal" : "Add Goal"}</CardTitle>
                    <Button variant="ghost" size="icon-sm" onClick={onCancel}>
                        <XIcon className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.category}
                            onChange={(e) => handleCategoryChange(e.target.value as Goal["category"])}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="body_composition">Body Composition</option>
                            <option value="strength">Strength</option>
                            <option value="endurance">Endurance</option>
                            <option value="mobility">Mobility</option>
                            <option value="skill">Skill</option>
                        </select>
                    </div>

                    {/* Body Composition Fields */}
                    {formData.category === "body_composition" && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Direction <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.direction || ""}
                                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as "increase" | "decrease" })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select direction</option>
                                    <option value="increase">Increase</option>
                                    <option value="decrease">Decrease</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Value
                                </label>
                                <input
                                    type="number"
                                    value={formData.value || ""}
                                    onChange={(e) => setFormData({ ...formData, value: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., 10"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Unit
                                </label>
                                <input
                                    type="text"
                                    value={formData.unit || ""}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., kg, lbs"
                                />
                            </div>
                        </>
                    )}

                    {/* Strength Fields */}
                    {formData.category === "strength" && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Exercise Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.target?.exercise || ""}
                                    onChange={(e) => setFormData({ 
                                        ...formData, 
                                        target: { ...formData.target, exercise: e.target.value } 
                                    })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., pull_up, bench_press"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Metric <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.target?.metric || ""}
                                    onChange={(e) => setFormData({ 
                                        ...formData, 
                                        target: { ...formData.target, metric: e.target.value as "weight" | "reps" } 
                                    })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select metric</option>
                                    <option value="reps">Reps</option>
                                    <option value="weight">Weight</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Direction
                                </label>
                                <select
                                    value={formData.direction || ""}
                                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as "increase" | "decrease" | "achieve" })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select direction</option>
                                    <option value="increase">Increase</option>
                                    <option value="decrease">Decrease</option>
                                    <option value="achieve">Achieve</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Target Value
                                </label>
                                <input
                                    type="number"
                                    value={formData.value || ""}
                                    onChange={(e) => setFormData({ ...formData, value: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., 10"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Unit
                                </label>
                                <input
                                    type="text"
                                    value={formData.unit || ""}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., reps, lbs, kg"
                                />
                            </div>
                        </>
                    )}

                    {/* Endurance Fields */}
                    {formData.category === "endurance" && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Movement <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.target?.movement || ""}
                                    onChange={(e) => setFormData({ 
                                        ...formData, 
                                        target: { ...formData.target, movement: e.target.value } 
                                    })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., mile_run, 5k_run"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Metric <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.target?.metric || ""}
                                    onChange={(e) => setFormData({ 
                                        ...formData, 
                                        target: { ...formData.target, metric: e.target.value as "time" | "distance" } 
                                    })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select metric</option>
                                    <option value="time">Time</option>
                                    <option value="distance">Distance</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Direction
                                </label>
                                <select
                                    value={formData.direction || ""}
                                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as "increase" | "decrease" | "achieve" })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select direction</option>
                                    <option value="increase">Increase</option>
                                    <option value="decrease">Decrease</option>
                                    <option value="achieve">Achieve</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Target Value
                                </label>
                                <input
                                    type="number"
                                    value={formData.value || ""}
                                    onChange={(e) => setFormData({ ...formData, value: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., 7.5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Unit
                                </label>
                                <input
                                    type="text"
                                    value={formData.unit || ""}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., minutes, km, miles"
                                />
                            </div>
                        </>
                    )}

                    {/* Mobility Fields */}
                    {formData.category === "mobility" && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Movement or Body Part <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.target?.movement || ""}
                                    onChange={(e) => setFormData({ 
                                        ...formData, 
                                        target: { ...formData.target, movement: e.target.value } 
                                    })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., hip_flexor_stretch, shoulder_mobility"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Metric
                                </label>
                                <select
                                    value={formData.target?.metric || ""}
                                    onChange={(e) => setFormData({ 
                                        ...formData, 
                                        target: { ...formData.target, metric: e.target.value as "rom" } 
                                    })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select metric (optional)</option>
                                    <option value="rom">Range of Motion</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Direction
                                </label>
                                <select
                                    value={formData.direction || ""}
                                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as "increase" | "decrease" | "achieve" })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select direction</option>
                                    <option value="increase">Increase</option>
                                    <option value="decrease">Decrease</option>
                                    <option value="achieve">Achieve</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Target Value
                                </label>
                                <input
                                    type="number"
                                    value={formData.value || ""}
                                    onChange={(e) => setFormData({ ...formData, value: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., 90"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Unit
                                </label>
                                <input
                                    type="text"
                                    value={formData.unit || ""}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., degrees"
                                />
                            </div>
                        </>
                    )}

                    {/* Skill Fields */}
                    {formData.category === "skill" && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Movement Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.target?.movement || ""}
                                    onChange={(e) => setFormData({ 
                                        ...formData, 
                                        target: { ...formData.target, movement: e.target.value } 
                                    })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., muscle_up, handstand"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#E6EAF0] mb-2">
                                    Direction
                                </label>
                                <select
                                    value={formData.direction || ""}
                                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as "increase" | "decrease" | "achieve" })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-[#E6EAF0] focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Select direction</option>
                                    <option value="increase">Increase</option>
                                    <option value="decrease">Decrease</option>
                                    <option value="achieve">Achieve</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Submit Buttons */}
                    <div className="flex gap-2 pt-4">
                        <Button type="submit" className="flex-1" disabled={isLoading}>
                            {isLoading ? "Saving..." : goal ? "Update Goal" : "Add Goal"}
                        </Button>
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};
