/**
 * Script to import exercises from a JSON file into the Convex database
 * 
 * Usage:
 *   npx tsx scripts/import-exercises.ts <path-to-exercises.json>
 * 
 * Or use the Convex dashboard to call the importExercises action with the JSON data
 */

import { readFileSync } from "fs";
import { join } from "path";

type Exercise = {
    name: string;
    bodyPart: string;
    isCompound: boolean;
    equipment?: string;
};

function parseExercisesFile(filePath: string): Exercise[] {
    try {
        const content = readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        
        if (Array.isArray(data)) {
            return data;
        } else if (data.exercises && Array.isArray(data.exercises)) {
            return data.exercises;
        } else {
            throw new Error("Invalid JSON format. Expected array or object with 'exercises' array");
        }
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to parse file: ${error.message}`);
        }
        throw error;
    }
}

function validateExercise(exercise: any): Exercise {
    if (!exercise.name || typeof exercise.name !== "string") {
        throw new Error("Exercise must have a 'name' field (string)");
    }
    if (!exercise.bodyPart || typeof exercise.bodyPart !== "string") {
        throw new Error("Exercise must have a 'bodyPart' field (string)");
    }
    if (typeof exercise.isCompound !== "boolean") {
        throw new Error("Exercise must have an 'isCompound' field (boolean)");
    }

    return {
        name: exercise.name.trim(),
        bodyPart: exercise.bodyPart.trim().toLowerCase(),
        isCompound: exercise.isCompound,
        equipment: exercise.equipment?.trim(),
    };
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
Usage: npx tsx scripts/import-exercises.ts <path-to-exercises.json>

Example:
  npx tsx scripts/import-exercises.ts data/exercises.json

The JSON file should contain an array of exercises with this structure:
[
  {
    "name": "Bench Press",
    "bodyPart": "chest",
    "isCompound": true,
    "equipment": "barbell"
  },
  ...
]
        `);
        process.exit(1);
    }

    const filePath = args[0];
    const fullPath = join(process.cwd(), filePath);

    console.log(`Reading exercises from: ${fullPath}`);

    try {
        const rawExercises = parseExercisesFile(fullPath);
        console.log(`Found ${rawExercises.length} exercises in file`);

        const validatedExercises: Exercise[] = [];
        const errors: Array<{ index: number; error: string }> = [];

        rawExercises.forEach((exercise, index) => {
            try {
                validatedExercises.push(validateExercise(exercise));
            } catch (error) {
                errors.push({
                    index,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });

        if (errors.length > 0) {
            console.error("\nValidation errors:");
            errors.forEach(({ index, error }) => {
                console.error(`  Exercise ${index}: ${error}`);
            });
        }

        console.log(`\nValidated ${validatedExercises.length} exercises`);
        console.log("\nTo import these exercises, use the Convex dashboard:");
        console.log("1. Go to your Convex dashboard");
        console.log("2. Navigate to Functions > plans > importExercises");
        console.log("3. Paste the following JSON as the 'exercises' argument:\n");
        console.log(JSON.stringify(validatedExercises, null, 2));

        console.log("\nOr use the Convex CLI:");
        console.log(`npx convex run plans:importExercises --exercises '${JSON.stringify(validatedExercises)}'`);
    } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export { parseExercisesFile, validateExercise };
