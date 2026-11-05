export const TRUTH_AND_DARE_CHARACTERS = [
  "boy",
  "girl",
  "man",
  "woman",
  "nonbinary",
  "mystery",
] as const;
export type TruthAndDareCharacter = (typeof TRUTH_AND_DARE_CHARACTERS)[number];

export const TRUTH_AND_DARE_AGE_GROUPS = ["family", "teen", "adult"] as const;
export type TruthAndDareAgeGroup = (typeof TRUTH_AND_DARE_AGE_GROUPS)[number];

export const TRUTH_AND_DARE_MODES = [
  "chill",
  "funny",
  "family",
  "couples",
  "spicy",
] as const;
export type TruthAndDareMode = (typeof TRUTH_AND_DARE_MODES)[number];

export const TRUTH_AND_DARE_SPINNERS = ["bottle", "wand", "compass"] as const;
export type TruthAndDareSpinner = (typeof TRUTH_AND_DARE_SPINNERS)[number];

export type TruthAndDareChoice = "truth" | "dare";

export interface TruthAndDareState {
  players: Array<{
    userId: string;
    name: string;
    image: string | null;
    character: TruthAndDareCharacter;
  }>;
  currentPlayerIndex: number;
  round: number;
  phase: "setup" | "choosing" | "selecting" | "challenge";
  settings: {
    ageGroup: TruthAndDareAgeGroup;
    spinner: TruthAndDareSpinner;
    mode: TruthAndDareMode;
  };
  selection: {
    spinnerId: string;
    spinnerName: string;
    targetId: string;
    createdAt: number;
  } | null;
  challenge: {
    type: TruthAndDareChoice;
    text: string;
    spinnerId: string;
    spinnerName: string;
    targetId: string;
    createdAt: number;
  } | null;
  history: Array<{
    playerId: string;
    playerName: string;
    spinnerName: string;
    ageGroup: TruthAndDareAgeGroup;
    mode: TruthAndDareMode;
    type: TruthAndDareChoice;
    result: "done" | "skip";
    prompt: string;
  }>;
  updatedAt: number;
}
