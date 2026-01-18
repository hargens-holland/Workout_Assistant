/**
 * Workouts Module - Exports all workout generators
 */

export { generateStrengthWorkout } from "./strengthWorkout";
export { generateEnduranceWorkout } from "./enduranceWorkout";
export { generateBodyCompositionWorkout } from "./bodyCompositionWorkout";
export { generateMobilityWorkout } from "./mobilityWorkout";
export { generateSkillWorkout } from "./skillWorkout";
export { checkFatigue, rotateBodyParts, hasInjuryForBodyParts, mapInjuryToBodyParts } from "./workoutUtils";
