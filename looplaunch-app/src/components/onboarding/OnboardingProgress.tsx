"use client";

import { TOTAL_QUESTION_STEPS } from "@/lib/onboarding/types";

interface OnboardingProgressProps {
  currentStep: number; // 1-based
}

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  if (currentStep > TOTAL_QUESTION_STEPS) return null;

  const padded = String(currentStep).padStart(2, "0");
  const total = String(TOTAL_QUESTION_STEPS).padStart(2, "0");

  return (
    <div className="text-text-tertiary text-sm font-medium tracking-wide select-none">
      {padded} / {total}
    </div>
  );
}
