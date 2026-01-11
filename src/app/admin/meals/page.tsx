"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import CornerElements from "@/components/CornerElements";
import { UploadIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";

const MealsAdminPage = () => {
    const [jsonInput, setJsonInput] = useState("");
    const [importResult, setImportResult] = useState<any>(null);
    const [isImporting, setIsImporting] = useState(false);

    const mealStats = useQuery(api.plans.getMealStats, {});
    const allMeals = useQuery(api.plans.getAllMeals, {});
    const importMeals = useAction(api.plans.importMeals);

    const handleImport = async () => {
        if (!jsonInput.trim()) {
            alert("Please paste JSON meal data");
            return;
        }

        setIsImporting(true);
        setImportResult(null);

        try {
            const meals = JSON.parse(jsonInput);
            if (!Array.isArray(meals)) {
                throw new Error("JSON must be an array of meals");
            }

            const result = await importMeals({ meals });
            setImportResult(result);
        } catch (error) {
            setImportResult({
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setIsImporting(false);
        }
    };

    const loadSampleData = () => {
        const sample = [
            {
                name: "Breakfast",
                foods: ["Oatmeal with berries", "Greek yogurt", "Black coffee"],
                calories: 450,
                instructions: ["Prepare oatmeal", "Add berries", "Serve with yogurt"],
            },
            {
                name: "Lunch",
                foods: ["Grilled chicken salad", "Whole grain bread", "Water"],
                calories: 600,
                instructions: ["Grill chicken", "Prepare salad", "Serve"],
            },
        ];
        setJsonInput(JSON.stringify(sample, null, 2));
    };

    return (
        <section className="relative z-10 pt-12 pb-32 flex-grow container mx-auto px-4">
            <div className="relative backdrop-blur-sm border border-border p-6 rounded-lg">
                <CornerElements />
                <h1 className="text-2xl font-bold tracking-tight mb-6">
                    <span className="text-primary">Meal</span>{" "}
                    <span className="text-foreground">Database Admin</span>
                </h1>

                {/* Stats */}
                {mealStats && (
                    <div className="mb-6 p-4 border border-border rounded-lg bg-background/50">
                        <h2 className="text-lg font-semibold mb-3">Database Statistics</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-2xl font-bold text-primary">
                                    {mealStats.total}
                                </div>
                                <div className="text-sm text-muted-foreground">Total Meals</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-primary">
                                    {mealStats.averageCalories}
                                </div>
                                <div className="text-sm text-muted-foreground">Avg Calories</div>
                            </div>
                            <div>
                                <div className="text-xl font-semibold">
                                    {mealStats.calorieRanges.low}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Low (&lt;300 cal)
                                </div>
                            </div>
                            <div>
                                <div className="text-xl font-semibold">
                                    {mealStats.calorieRanges.medium}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Medium (300-600 cal)
                                </div>
                            </div>
                            <div>
                                <div className="text-xl font-semibold">
                                    {mealStats.calorieRanges.high}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    High (≥600 cal)
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Import Section */}
                <div className="mb-6 p-4 border border-border rounded-lg">
                    <h2 className="text-lg font-semibold mb-3">Import Meals</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Paste JSON Meal Data
                            </label>
                            <textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                className="w-full h-48 p-3 border border-border rounded-lg font-mono text-sm bg-background"
                                placeholder='[\n  {\n    "name": "Breakfast",\n    "foods": ["Oatmeal", "Yogurt"],\n    "calories": 450,\n    "instructions": ["Prepare oatmeal", "Add yogurt"]\n  }\n]'
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleImport}
                                disabled={isImporting || !jsonInput.trim()}
                                className="bg-primary text-primary-foreground"
                            >
                                <UploadIcon className="mr-2 h-4 w-4" />
                                {isImporting ? "Importing..." : "Import Meals"}
                            </Button>
                            <Button
                                onClick={loadSampleData}
                                variant="outline"
                                className="border-primary/50 text-primary"
                            >
                                Load Sample
                            </Button>
                        </div>
                    </div>

                    {importResult && (
                        <div
                            className={`mt-4 p-4 rounded-lg ${
                                importResult.success
                                    ? "bg-green-500/10 border border-green-500/50"
                                    : "bg-red-500/10 border border-red-500/50"
                            }`}
                        >
                            {importResult.success ? (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                        <span className="font-semibold">Import Successful</span>
                                    </div>
                                    <div className="text-sm space-y-1">
                                        <div>Imported: {importResult.imported} meals</div>
                                        {importResult.failed > 0 && (
                                            <div className="text-yellow-500">
                                                Failed: {importResult.failed} meals
                                            </div>
                                        )}
                                    </div>
                                    {importResult.errors && importResult.errors.length > 0 && (
                                        <div className="mt-2 text-xs">
                                            <div className="font-semibold">Errors:</div>
                                            {importResult.errors.map((err: any, idx: number) => (
                                                <div key={idx} className="text-red-400">
                                                    {err.meal}: {err.error}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircleIcon className="h-5 w-5 text-red-500" />
                                        <span className="font-semibold">Import Failed</span>
                                    </div>
                                    <div className="text-sm text-red-400">
                                        {importResult.error}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Meal List */}
                {allMeals && allMeals.length > 0 && (
                    <div className="p-4 border border-border rounded-lg">
                        <h2 className="text-lg font-semibold mb-3">
                            All Meals ({allMeals.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                            {allMeals.map((meal) => (
                                <div
                                    key={meal._id}
                                    className="p-3 border border-border rounded bg-background/50"
                                >
                                    <div className="font-semibold">{meal.name}</div>
                                    <div className="text-xs text-muted-foreground space-y-1 mt-1">
                                        <div className="text-primary font-medium">
                                            {meal.calories} calories
                                        </div>
                                        <div className="text-xs">
                                            {meal.foods.length} food{meal.foods.length !== 1 ? "s" : ""}
                                        </div>
                                        {meal.foods.length > 0 && (
                                            <div className="text-xs italic">
                                                {meal.foods.slice(0, 2).join(", ")}
                                                {meal.foods.length > 2 && "..."}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default MealsAdminPage;
