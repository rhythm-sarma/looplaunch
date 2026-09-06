"use client";

import { useOnboarding } from "@/lib/onboarding/context";
import {
  OnboardingQuestion,
  TextAreaInput,
} from "@/components/onboarding/OnboardingQuestion";

export function AudienceStep() {
  const { data, updateField, goNext } = useOnboarding();

  return (
    <OnboardingQuestion
      heading="Who are your target customers?"
      subtext="Describe the people or businesses you want to reach."
      onContinue={goNext}
      continueDisabled={!data.targetAudience.trim()}
      animationKey="audience"
    >
      <TextAreaInput
        value={data.targetAudience}
        onChange={(v) => updateField("targetAudience", v)}
        placeholder="Example: Small and mid-sized healthcare clinics in India..."
        onCmdEnter={goNext}
      />
    </OnboardingQuestion>
  );
}
