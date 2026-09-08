/**
 * Onboarding data model.
 * This object is collected during onboarding and will eventually
 * be sent to the backend analysis pipeline.
 *
 * Updated to match founder's spec (Sep 2026).
 */
export interface OnboardingData {
  companyName: string;
  nameAndRole: string;
  whatTheySell: string;
  website: string;
  competitors: string;
  painPoint: string;
  whyTheyreHere: string[];  // multi-select options
}

export const EMPTY_ONBOARDING: OnboardingData = {
  companyName: "",
  nameAndRole: "",
  whatTheySell: "",
  website: "",
  competitors: "",
  painPoint: "",
  whyTheyreHere: [],
};

/**
 * "Why they're here" options — these quietly show everything Loopy can do.
 */
export const WHY_HERE_OPTIONS = [
  "Test if my marketing is even working",
  "Find where I'm burning money",
  "Know what to do this month",
  "Find an angle my competitors are missing",
  "Get content ideas that fit my plan",
  "Get a second opinion before I spend or hire more",
];

/**
 * Step definitions for the onboarding flow.
 */
export type StepKey =
  | "companyName"
  | "nameAndRole"
  | "whatTheySell"
  | "website"
  | "competitors"
  | "painPoint"
  | "whyTheyreHere"
  | "review";

export interface StepConfig {
  key: StepKey;
  number: number;
  field?: keyof OnboardingData;
  heading: string;
  subtext: string;
  placeholder?: string;
  inputType: "text" | "textarea" | "multiselect";
  optional?: boolean;
  skipLabel?: string;
}

export const STEPS: StepConfig[] = [
  {
    key: "companyName",
    number: 1,
    field: "companyName",
    heading: "What's your company called?",
    subtext:
      "Let's start with the basics.",
    placeholder: "e.g. Acme Corp",
    inputType: "text",
  },
  {
    key: "nameAndRole",
    number: 2,
    field: "nameAndRole",
    heading: "What's your name and role?",
    subtext:
      "So we know who we're talking to.",
    placeholder: "e.g. Priya Sharma, Co-founder",
    inputType: "text",
  },
  {
    key: "whatTheySell",
    number: 3,
    field: "whatTheySell",
    heading: "What do you sell, and who buys it?",
    subtext:
      "Keep it simple — one or two lines is plenty.",
    placeholder:
      "e.g. We sell project management software to small marketing agencies.",
    inputType: "textarea",
  },
  {
    key: "website",
    number: 4,
    field: "website",
    heading: "What's your website?",
    subtext:
      "Drop your link so Loop Launch can start understanding your business.",
    placeholder: "yourcompany.com",
    inputType: "text",
  },
  {
    key: "competitors",
    number: 5,
    field: "competitors",
    heading: "Who are your competitors?",
    subtext:
      "Name up to 3 companies you think you're competing with. If you're not sure, skip this.",
    placeholder: "e.g.\nCompetitor A\nCompetitor B\ncompetitor.com",
    inputType: "textarea",
    optional: true,
    skipLabel: "I'm not sure yet",
  },
  {
    key: "painPoint",
    number: 6,
    field: "painPoint",
    heading: "What's actually bugging you right now?",
    subtext:
      "A line or two on the marketing problem that brought you here.",
    placeholder:
      "e.g. We're spending on ads but have no idea if they're working. Leads are inconsistent.",
    inputType: "textarea",
  },
  {
    key: "whyTheyreHere",
    number: 7,
    field: "whyTheyreHere",
    heading: "Why are you here?",
    subtext:
      "Pick everything that applies — this helps us focus on what matters to you.",
    inputType: "multiselect",
  },
  {
    key: "review",
    number: 8,
    heading: "Here's what we know so far.",
    subtext: "Review your answers and edit anything you'd like to change.",
    inputType: "text", // unused for review
  },
];

export const TOTAL_QUESTION_STEPS = STEPS.length - 1; // exclude review
