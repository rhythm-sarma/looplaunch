"use client";

import { useState } from "react";
import { useOnboarding } from "@/lib/onboarding/context";
import {
  OnboardingQuestion,
  TextInput,
} from "@/components/onboarding/OnboardingQuestion";
import { isValidUrl, normalizeUrl } from "@/lib/onboarding/validation";

export function WebsiteStep() {
  const { data, updateField, goNext } = useOnboarding();
  const [error, setError] = useState("");

  const handleContinue = () => {
    if (!data.website.trim()) {
      setError("Please enter your website URL.");
      return;
    }
    if (!isValidUrl(data.website)) {
      setError("That doesn't look like a valid URL. Try something like example.com");
      return;
    }
    setError("");
    updateField("website", normalizeUrl(data.website));
    goNext();
  };

  return (
    <OnboardingQuestion
      heading="What's your website?"
      subtext="Paste your company website so Loop Launch can start understanding your business."
      onContinue={handleContinue}
      continueDisabled={!data.website.trim()}
      animationKey="website"
    >
      <TextInput
        value={data.website}
        onChange={(v) => {
          updateField("website", v);
          if (error) setError("");
        }}
        placeholder="https://yourwebsite.com"
        onEnter={handleContinue}
        error={error}
      />
    </OnboardingQuestion>
  );
}
