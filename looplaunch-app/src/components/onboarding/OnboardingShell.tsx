"use client";

import { LandingPage } from "@/components/landing/LandingPage";

export function OnboardingShell() {
  // Always render the full Landing Page so the user stays in the exact same section
  // while questions seamlessly transition inline inside the Hero section!
  return <LandingPage />;
}
