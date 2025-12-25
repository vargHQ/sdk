/**
 * Skill definitions index
 */

export { definition as talkingCharacter } from "./talking-character";
export { definition as textToTiktok } from "./text-to-tiktok";

// All skill definitions for auto-loading
import { definition as talkingCharacterDefinition } from "./talking-character";
import { definition as textToTiktokDefinition } from "./text-to-tiktok";

export const allSkills = [talkingCharacterDefinition, textToTiktokDefinition];
