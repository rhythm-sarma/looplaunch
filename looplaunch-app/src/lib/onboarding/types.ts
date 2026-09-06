/**
 * Onboarding data model.
 * This object is collected during onboarding and will eventually
 * be sent to the backend analysis pipeline.
 */
export interface OnboardingData {
  website: string;
  companyDescription: string;
  targetAudience: string;
  competitors: string;
  primaryGoal: string;
  currentMarketing: string;
  constraints: string;
}

export const EMPTY_ONBOARDING: OnboardingData = {
  website: "",
  companyDescription: "",
  targetAudience: "",
  competitors: "",
  primaryGoal: "",
  currentMarketing: "",
  constraints: "",
};

/**
 * Step definitions for the onboarding flow.
 */
export type StepKey =
  | "website"
  | "company"
  | "audience"
  | "competitors"
  | "goal"
  | "marketing"
  | "constraints"
  | "review";

export interface StepConfig {
  key: StepKey;
  number: number;
  field?: keyof OnboardingData;
  heading: string;
  subtext: string;
  placeholder?: string;
  inputType: "text" | "textarea";
  optional?: boolean;
  skipLabel?: string;
}

export const STEPS: StepConfig[] = [
  {
    key: "website",
    number: 1,
    field: "website",
    heading: "What's your website?",
    subtext:
      "Paste your company website so Loop Launch can start understanding your business.",
    placeholder: "https://yourwebsite.com",
    inputType: "text",
  },
  {
    key: "company",
    number: 2,
    field: "companyDescription",
    heading: "What does your company do?",
    subtext:
      "Give us a simple explanation. Don't worry about making it sound perfect.",
    placeholder:
      "Example: We help independent clinics automate patient communication and appointment booking.",
    inputType: "textarea",
  },
  {
    key: "audience",
    number: 3,
    field: "targetAudience",
    heading: "Who are your target customers?",
    subtext: "Describe the people or businesses you want to reach.",
    placeholder:
      "Example: Small and mid-sized healthcare clinics in India...",
    inputType: "textarea",
  },
  {
    key: "competitors",
    number: 4,
    field: "competitors",
    heading: "Who are your competitors?",
    subtext:
      "Tell us who you consider competitors. If you're not sure, that's okay — Loop Launch can research them later.",
    placeholder: "Example:\nCompetitor A\nCompetitor B\ncompetitor.com",
    inputType: "textarea",
    optional: true,
    skipLabel: "I don't know yet",
  },
  {
    key: "goal",
    number: 5,
    field: "primaryGoal",
    heading: "What are you trying to achieve?",
    subtext:
      "What's the main outcome you want from your marketing?",
    placeholder:
      "Example: Increase qualified leads, improve positioning, enter a new market...",
    inputType: "textarea",
  },
  {
    key: "marketing",
    number: 6,
    field: "currentMarketing",
    heading: "How are you currently getting customers?",
    subtext:
      "Tell us about your current marketing and acquisition channels.",
    placeholder:
      "Example: Mostly referrals and Instagram. We haven't run paid ads yet.",
    inputType: "textarea",
    optional: true,
    skipLabel: "I don't know yet",
  },
  {
    key: "constraints",
    number: 7,
    field: "constraints",
    heading: "Anything we should know?",
    subtext:
      "Budget, team size, geography, timeline, limitations, or anything else that could affect the strategy.",
    placeholder:
      "Example: Small team, limited marketing budget, launching in the US within 3 months.",
    inputType: "textarea",
    optional: true,
    skipLabel: "Nothing for now",
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
