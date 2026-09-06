"use client";

import { OnboardingProvider } from "@/lib/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export default function Home() {
  return (
    <OnboardingProvider>
      <OnboardingShell />
    </OnboardingProvider>
  );
}
