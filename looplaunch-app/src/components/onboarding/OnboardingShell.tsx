"use client";

import { useOnboarding } from "@/lib/onboarding/context";
import { OnboardingProgress } from "./OnboardingProgress";
import { Mascot } from "./Mascot";
import { LandingPage } from "@/components/landing/LandingPage";
import { CompanyStep } from "./CompanyStep";
import { AudienceStep } from "./AudienceStep";
import { CompetitorsStep } from "./CompetitorsStep";
import { GoalStep } from "./GoalStep";
import { MarketingStep } from "./MarketingStep";
import { ConstraintsStep } from "./ConstraintsStep";
import { ReviewStep } from "./ReviewStep";

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  company: CompanyStep,
  audience: AudienceStep,
  competitors: CompetitorsStep,
  goal: GoalStep,
  marketing: MarketingStep,
  constraints: ConstraintsStep,
  review: ReviewStep,
};

export function OnboardingShell() {
  const { currentStep, currentStepIndex, canGoPrev, goPrev, goToStep } =
    useOnboarding();

  // If on the entry step (website), render the full high-end landing page
  // where the Hero section serves as the website onboarding input!
  if (currentStepIndex === 0) {
    return <LandingPage />;
  }

  const StepComponent = STEP_COMPONENTS[currentStep.key];
  const isReview = currentStep.key === "review";

  return (
    <main className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      {/* Top bar for question steps */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-8 py-5 border-b border-border-subtle/50 bg-bg-primary/80 backdrop-blur-md">
        {/* Back button */}
        <div className="w-24">
          {canGoPrev && (
            <button
              onClick={goPrev}
              className="
                text-text-secondary hover:text-text-primary
                text-sm font-medium flex items-center gap-1.5
                transition-colors duration-200 cursor-pointer
              "
            >
              &larr; Back
            </button>
          )}
        </div>

        {/* Logo / Wordmark — Clicking returns to landing page */}
        <button
          onClick={() => goToStep(0)}
          className="flex items-center gap-2 select-none group cursor-pointer"
          title="Return to Home"
        >
          <span className="text-text-primary font-semibold text-base tracking-tight">
            Loop Launch
          </span>
        </button>

        {/* Progress counter */}
        <div className="w-24 flex justify-end">
          <OnboardingProgress currentStep={currentStepIndex + 1} />
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-8 py-12">
        {/* Mascot */}
        <div className="mb-8">
          <Mascot size={isReview ? 52 : 64} variant="default" />
        </div>

        {/* Current step */}
        {StepComponent ? <StepComponent /> : null}
      </div>
    </main>
  );
}
