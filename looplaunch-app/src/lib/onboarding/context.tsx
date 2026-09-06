"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  type OnboardingData,
  type StepKey,
  EMPTY_ONBOARDING,
  STEPS,
} from "./types";

const STORAGE_KEY = "looplaunch-onboarding";

interface OnboardingContextValue {
  data: OnboardingData;
  currentStepIndex: number;
  currentStep: (typeof STEPS)[number];
  totalSteps: number;
  updateField: (field: keyof OnboardingData, value: string) => void;
  goNext: () => void;
  goPrev: () => void;
  goToStep: (index: number) => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  isComplete: boolean;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(EMPTY_ONBOARDING);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data) setData(parsed.data);
        if (typeof parsed.step === "number") setCurrentStepIndex(parsed.step);
      }
    } catch {
      // Ignore parse errors
    }
    setHydrated(true);
  }, []);

  // Persist to sessionStorage on change
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ data, step: currentStepIndex })
      );
    } catch {
      // Storage full or unavailable
    }
  }, [data, currentStepIndex, hydrated]);

  const currentStep = STEPS[currentStepIndex];
  const totalSteps = STEPS.length;

  const updateField = useCallback(
    (field: keyof OnboardingData, value: string) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const goNext = useCallback(() => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const goPrev = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback((index: number) => {
    setCurrentStepIndex(Math.max(0, Math.min(index, STEPS.length - 1)));
  }, []);

  const reset = useCallback(() => {
    setData(EMPTY_ONBOARDING);
    setCurrentStepIndex(0);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const canGoNext = currentStepIndex < STEPS.length - 1;
  const canGoPrev = currentStepIndex > 0;
  const isComplete = currentStepIndex === STEPS.length - 1;

  // Don't render children until hydrated to avoid flash
  if (!hydrated) {
    return null;
  }

  return (
    <OnboardingContext.Provider
      value={{
        data,
        currentStepIndex,
        currentStep,
        totalSteps,
        updateField,
        goNext,
        goPrev,
        goToStep,
        canGoNext,
        canGoPrev,
        isComplete,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
