/**
 * Onboarding data model.
 * This object is collected during onboarding and will eventually
 * be sent to the backend analysis pipeline.
 *
 * Updated to match founder's 9-question spec (Oct 2026), plus an optional pitch deck (Nov 2026).
 */
import type { PitchDeckUpload } from "@/lib/intelligence/types";

export type { PitchDeckUpload };

export interface OnboardingData {
  /** Q1: Website or primary page URL */
  website: string;
  /** Q2: What hat are you wearing for this brand? (single-select) */
  role: string;
  /** Q3: Which industry are you in? (single-select) */
  industry: string;
  /** Q4: What stage are you at? (single-select) */
  stage: string;
  /** Q5: What's your core offer or product in a nutshell? (free text) */
  coreOffer: string;
  /** Q6: Who buys from you? (multi-select, up to 2) */
  audience: string[];
  /** Q7: Where do you sell? (multi-select, pick all that apply) */
  salesChannels: string[];
  /** Q8: Biggest marketing headache right now? (single-select) */
  biggestHeadache: string;
  /** Q9: What do you want in the next 30 days? (single-select) */
  thirtyDayGoal: string;
  /** Optional extra: a pitch deck or company PDF, with the text /api/intelligence/deck read from it */
  pitchDeck: PitchDeckUpload | null;
}

export const EMPTY_ONBOARDING: OnboardingData = {
  website: "",
  role: "",
  industry: "",
  stage: "",
  coreOffer: "",
  audience: [],
  salesChannels: [],
  biggestHeadache: "",
  thirtyDayGoal: "",
  pitchDeck: null,
};

/** An answer as one line of text, for the review list and the brief. */
export function answerText(data: OnboardingData, field: keyof OnboardingData): string {
  const value = data[field];
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return `${value.fileName} (${value.pages} ${value.kind === "pptx" ? "slide" : "page"}${value.pages === 1 ? "" : "s"})`;
  return value || "";
}

// ──────────────────────────────────────────────
// Option arrays for select-based questions
// ──────────────────────────────────────────────

export const ROLE_OPTIONS = [
  "Founder / Co-founder",
  "Solo Marketer",
  "Agency",
  "Team Member",
];

export const INDUSTRY_OPTIONS = [
  "Fashion & Apparel",
  "Beauty & Skincare",
  "Food & Beverage",
  "Health & Fitness",
  "Home & Decor",
  "Tech & SaaS",
  "Education & Coaching",
  "Jewelry & Accessories",
  "Services & Freelancing",
  "Other",
];

export const STAGE_OPTIONS = [
  "Idea",
  "Just launched",
  "Under 1 year selling",
  "1 to 3 years",
  "3+ years",
];

export const AUDIENCE_OPTIONS = [
  "Gen Z",
  "Young professionals",
  "Parents",
  "Premium buyers",
  "Budget buyers",
  "Other businesses",
];

export const SALES_CHANNEL_OPTIONS = [
  "Instagram / DMs",
  "Own website",
  "Marketplaces",
  "Offline store",
  "WhatsApp",
];

export const HEADACHE_OPTIONS = [
  "I sound like everyone else",
  "I don't know what to post",
  "Posting but no sales",
  "Can't explain why I'm different",
  "Paid for help and got generic stuff",
];

export const THIRTY_DAY_GOAL_OPTIONS = [
  "More followers",
  "More sales",
  "A launch or drop",
  "A clearer brand",
  "More leads",
];

// ──────────────────────────────────────────────
// Step definitions for the onboarding flow
// ──────────────────────────────────────────────

export type StepKey =
  | "website"
  | "role"
  | "industry"
  | "stage"
  | "coreOffer"
  | "audience"
  | "salesChannels"
  | "biggestHeadache"
  | "thirtyDayGoal"
  | "pitchDeck"
  | "review";

export interface StepConfig {
  key: StepKey;
  number: number;
  field?: keyof OnboardingData;
  heading: string;
  subtext: string;
  placeholder?: string;
  /** Input rendering type */
  inputType: "text" | "textarea" | "singleselect" | "multiselect" | "upload";
  /** For multiselect: max number of selections allowed (undefined = unlimited) */
  maxSelections?: number;
  optional?: boolean;
  skipLabel?: string;
}

export const STEPS: StepConfig[] = [
  {
    key: "website",
    number: 1,
    field: "website",
    heading: "Drop your website or primary page below.",
    subtext:
      "We'll crawl it to understand your brand, products, and messaging.",
    placeholder: "yourcompany.com",
    inputType: "text",
  },
  {
    key: "role",
    number: 2,
    field: "role",
    heading: "What hat are you wearing for this brand?",
    subtext: "This helps us tailor the strategy to your day-to-day.",
    inputType: "singleselect",
  },
  {
    key: "industry",
    number: 3,
    field: "industry",
    heading: "Which industry are you in?",
    subtext: "Pick one, and we'll dial in the strategy for your space.",
    inputType: "singleselect",
  },
  {
    key: "stage",
    number: 4,
    field: "stage",
    heading: "What stage are you at?",
    subtext: "Where you are changes what you should focus on first.",
    inputType: "singleselect",
  },
  {
    key: "coreOffer",
    number: 5,
    field: "coreOffer",
    heading: "What's your core offer or product in a nutshell?",
    subtext: "Keep it simple. One or two lines is plenty.",
    placeholder:
      "e.g. We sell handmade linen shirts for men who want comfort without trying.",
    inputType: "textarea",
  },
  {
    key: "audience",
    number: 6,
    field: "audience",
    heading: "Who buys from you?",
    subtext: "Pick up to 2. Who's on the receiving end of your offer?",
    inputType: "multiselect",
    maxSelections: 2,
  },
  {
    key: "salesChannels",
    number: 7,
    field: "salesChannels",
    heading: "Where do you sell?",
    subtext: "Pick all that apply.",
    inputType: "multiselect",
  },
  {
    key: "biggestHeadache",
    number: 8,
    field: "biggestHeadache",
    heading: "What's your biggest marketing headache right now?",
    subtext: "Pick the one that stings the most.",
    inputType: "singleselect",
  },
  {
    key: "thirtyDayGoal",
    number: 9,
    field: "thirtyDayGoal",
    heading: "What do you want in the next 30 days?",
    subtext: "Pick one. This is what we'll build your week around.",
    inputType: "singleselect",
  },
  {
    key: "pitchDeck",
    number: 10,
    field: "pitchDeck",
    heading: "Got a pitch deck? Add it for a sharper plan.",
    subtext:
      "Optional. Loopy reads it alongside your website, so the plan fits your customers, your numbers and your goals.",
    inputType: "upload",
    optional: true,
    skipLabel: "Skip this step",
  },
  {
    key: "review",
    number: 11,
    heading: "Here's what we have so far.",
    subtext: "Review your answers and edit anything you'd like to change.",
    inputType: "text", // unused for review
  },
];

/** The nine questions; the pitch deck is an optional extra and the review isn't a question. */
export const TOTAL_QUESTION_STEPS = STEPS.filter((s) => s.key !== "review" && !s.optional).length;
