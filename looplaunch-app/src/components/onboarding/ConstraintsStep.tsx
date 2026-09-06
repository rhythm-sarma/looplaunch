"use client";

import { useOnboarding } from "@/lib/onboarding/context";
import {
  OnboardingQuestion,
  TextAreaInput,
} from "@/components/onboarding/OnboardingQuestion";

export function ConstraintsStep() {
  const { data, updateField, goNext } = useOnboarding();

  const handleSkip = () => {
    updateField("constraints", "");
    goNext();
  };

  return (
    <OnboardingQuestion
      heading="Anything we should know?"
      subtext="Budget, team size, geography, timeline, limitations, or anything else that could affect the strategy."
      onContinue={goNext}
      animationKey="constraints"
      skipLabel="Nothing for now"
      onSkip={handleSkip}
    >
      <TextAreaInput
        value={data.constraints}
        onChange={(v) => updateField("constraints", v)}
        placeholder="Example: Small team, limited marketing budget, launching in the US within 3 months."
        onCmdEnter={goNext}
      />
    </OnboardingQuestion>
  );
}
