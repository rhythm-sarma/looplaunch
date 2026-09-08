"use client";

import { useOnboarding } from "@/lib/onboarding/context";
import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { WhatIsLoopLaunchSection } from "./WhatIsLoopLaunchSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { DeepResearchSection } from "./DeepResearchSection";
import { StrategicIntelligenceSection } from "./StrategicIntelligenceSection";
import { StrategyOutputSection } from "./StrategyOutputSection";
import { RoadmapSection } from "./RoadmapSection";
import { FinalCtaSection } from "./FinalCtaSection";
import { LandingFooter } from "./LandingFooter";

export function LandingPage() {
  const { data, goToStep } = useOnboarding();

  const handleStartOnboarding = () => {
    goToStep(0);
    const heroSection = document.getElementById("hero-section");
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScrollToHero = () => {
    const heroSection = document.getElementById("hero-section");
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary selection:bg-white/10 selection:text-white">
      {/* 1. Navigation */}
      <LandingNav onGetStarted={handleScrollToHero} />

      {/* 2 & 3. Hero / Inline Onboarding Flow */}
      <HeroSection />

      {/* 4. Section — What is Loop Launch? */}
      <WhatIsLoopLaunchSection />

      {/* 5. Section — How It Works */}
      <HowItWorksSection />

      {/* 6. Deep Research Section */}
      <DeepResearchSection />

      {/* 7. Strategic Intelligence Section */}
      <StrategicIntelligenceSection />

      {/* 8. Strategy Output Section */}
      <StrategyOutputSection />

      {/* 9. 30 / 60 / 90 Roadmap */}
      <RoadmapSection />

      {/* 10. Final CTA */}
      <FinalCtaSection
        onGetStarted={handleStartOnboarding}
      />

      {/* 11. Footer */}
      <LandingFooter />
    </div>
  );
}
