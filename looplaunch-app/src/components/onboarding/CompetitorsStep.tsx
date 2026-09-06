"use client";

import { useOnboarding } from "@/lib/onboarding/context";
import {
  OnboardingQuestion,
  TextAreaInput,
} from "@/components/onboarding/OnboardingQuestion";

export function CompetitorsStep() {
  const { data, updateField, goNext } = useOnboarding();

  const handleSkip = () => {
    updateField("competitors", "");
    goNext();
  };

  return (
    <OnboardingQuestion
      heading="Who are your competitors?"
      subtext="Tell us who you consider competitors. If you're not sure, that's okay — Loop Launch can research them later."
      onContinue={goNext}
      animationKey="competitors"
      skipLabel="I don't know yet"
      onSkip={handleSkip}
    >
      <TextAreaInput
        value={data.competitors}
        onChange={(v) => updateField("competitors", v)}
        placeholder={"Example:\nCompetitor A\nCompetitor B\ncompetitor.com"}
        onCmdEnter={goNext}
      />
    </OnboardingQuestion>
  );
}
