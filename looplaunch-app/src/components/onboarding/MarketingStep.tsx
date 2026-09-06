"use client";

import { useOnboarding } from "@/lib/onboarding/context";
import {
  OnboardingQuestion,
  TextAreaInput,
} from "@/components/onboarding/OnboardingQuestion";

export function MarketingStep() {
  const { data, updateField, goNext } = useOnboarding();

  const handleSkip = () => {
    updateField("currentMarketing", "");
    goNext();
  };

  return (
    <OnboardingQuestion
      heading="How are you currently getting customers?"
      subtext="Tell us about your current marketing and acquisition channels."
      onContinue={goNext}
      animationKey="marketing"
      skipLabel="I don't know yet"
      onSkip={handleSkip}
    >
      <TextAreaInput
        value={data.currentMarketing}
        onChange={(v) => updateField("currentMarketing", v)}
        placeholder="Example: Mostly referrals and Instagram. We haven't run paid ads yet."
        onCmdEnter={goNext}
      />
    </OnboardingQuestion>
  );
}
