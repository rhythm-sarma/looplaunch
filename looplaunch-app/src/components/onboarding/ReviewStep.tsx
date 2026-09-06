"use client";

import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding/context";
import type { OnboardingData } from "@/lib/onboarding/types";

interface ReviewField {
  label: string;
  field: keyof OnboardingData;
  stepIndex: number;
}

const REVIEW_FIELDS: ReviewField[] = [
  { label: "Website", field: "website", stepIndex: 0 },
  { label: "Company", field: "companyDescription", stepIndex: 1 },
  { label: "Target audience", field: "targetAudience", stepIndex: 2 },
  { label: "Competitors", field: "competitors", stepIndex: 3 },
  { label: "Goal", field: "primaryGoal", stepIndex: 4 },
  { label: "Current marketing", field: "currentMarketing", stepIndex: 5 },
  { label: "Constraints", field: "constraints", stepIndex: 6 },
];

export function ReviewStep() {
  const { data, goToStep } = useOnboarding();
  const router = useRouter();

  const handleLaunch = () => {
    // Future: send `data` to backend API
    // For now, navigate to the placeholder ready page
    router.push("/ready");
  };

  return (
    <div className="animate-fade-in-up w-full max-w-xl mx-auto">
      <h1 className="text-3xl sm:text-4xl font-semibold text-text-primary leading-tight mb-2">
        Here&apos;s what we know so far.
      </h1>
      <p className="text-text-secondary text-base sm:text-lg leading-relaxed mb-10">
        Review your answers and edit anything you&apos;d like to change.
      </p>

      <div className="space-y-0">
        {REVIEW_FIELDS.map(({ label, field, stepIndex }) => {
          const value = data[field];
          const isEmpty = !value.trim();

          return (
            <div
              key={field}
              className="group py-5 border-b border-border-subtle last:border-b-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary mb-1.5 font-medium">
                    {label}
                  </p>
                  <p
                    className={`text-base leading-relaxed whitespace-pre-wrap break-words ${
                      isEmpty
                        ? "text-text-tertiary italic"
                        : "text-text-primary"
                    }`}
                  >
                    {isEmpty ? "Not provided" : value}
                  </p>
                </div>
                <button
                  onClick={() => goToStep(stepIndex)}
                  className="
                    shrink-0 text-sm text-text-tertiary
                    hover:text-text-primary
                    opacity-0 group-hover:opacity-100
                    transition-all duration-200
                    focus-visible:opacity-100
                  "
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Launch CTA */}
      <div className="mt-12 text-center">
        <p className="text-text-secondary text-sm mb-4">Ready to launch?</p>
        <button
          onClick={handleLaunch}
          className="
            px-8 py-4 rounded-lg font-semibold text-base
            bg-text-primary text-bg-primary
            hover:bg-accent
            transition-all duration-200
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary
          "
        >
          Start analysis &rarr;
        </button>
      </div>
    </div>
  );
}
