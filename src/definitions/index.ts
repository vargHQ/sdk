/**
 * Definitions index
 * Re-exports all actions, models, and skills
 */

// Actions
export * from "./actions";
export { allActions } from "./actions";

// Models
export * from "./models";
export { allModels } from "./models";

// Skills
export * from "./skills";
export { allSkills } from "./skills";

// All definitions combined
import { allActions } from "./actions";
import { allModels } from "./models";
import { allSkills } from "./skills";

export const allDefinitions = [...allModels, ...allActions, ...allSkills];
