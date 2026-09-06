"use client";

import { useOnboarding } from "@/lib/onboarding/context";
import {
  OnboardingQuestion,
  TextAreaInput,
} from "@/components/onboarding/OnboardingQuestion";

export function CompanyStep() {
  const { data, updateField, goNext } = useOnboarding();

  return (
    <OnboardingQuestion
      heading="What does your company do?"
      subtext="Give us a simple explanation. Don't worry about making it sound perfect."
      onContinue={goNext}
      continueDisabled={!data.companyDescription.trim()}
      animationKey="company"
    >
      <TextAreaInput
        value={data.companyDescription}
        onChange={(v) => updateField("companyDescription", v)}
        placeholder="Example: We help independent clinics automate patient communication and appointment booking."
        onCmdEnter={goNext}
      />
    </OnboardingQuestion>
  );
}
