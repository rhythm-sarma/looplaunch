"use client";

import { useOnboarding } from "@/lib/onboarding/context";
import {
  OnboardingQuestion,
  TextAreaInput,
} from "@/components/onboarding/OnboardingQuestion";

export function GoalStep() {
  const { data, updateField, goNext } = useOnboarding();

  return (
    <OnboardingQuestion
      heading="What are you trying to achieve?"
      subtext="What's the main outcome you want from your marketing?"
      onContinue={goNext}
      continueDisabled={!data.primaryGoal.trim()}
      animationKey="goal"
    >
      <TextAreaInput
        value={data.primaryGoal}
        onChange={(v) => updateField("primaryGoal", v)}
        placeholder="Example: Increase qualified leads, improve positioning, enter a new market..."
        onCmdEnter={goNext}
      />
    </OnboardingQuestion>
  );
}
