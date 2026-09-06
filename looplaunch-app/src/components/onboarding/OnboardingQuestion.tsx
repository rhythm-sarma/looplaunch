"use client";

import { useRef, useEffect, type ReactNode, type KeyboardEvent } from "react";

interface OnboardingQuestionProps {
  heading: string;
  subtext: string;
  children: ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
  animationKey: string;
}

export function OnboardingQuestion({
  heading,
  subtext,
  children,
  onContinue,
  continueLabel = "Continue \u2192",
  continueDisabled = false,
  skipLabel,
  onSkip,
  animationKey,
}: OnboardingQuestionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus the first input when the step appears
  useEffect(() => {
    const timer = setTimeout(() => {
      const input = containerRef.current?.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >("input, textarea");
      input?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [animationKey]);

  return (
    <div
      ref={containerRef}
      key={animationKey}
      className="animate-fade-in-up w-full max-w-xl mx-auto"
    >
      {/* Heading */}
      <h1 className="text-3xl sm:text-4xl font-semibold text-text-primary leading-tight mb-3">
        {heading}
      </h1>

      {/* Subtext */}
      <p className="text-text-secondary text-base sm:text-lg leading-relaxed mb-8">
        {subtext}
      </p>

      {/* Input area */}
      <div className="mb-6">{children}</div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={onContinue}
          disabled={continueDisabled}
          className="
            px-6 py-3 rounded-lg font-medium text-sm
            bg-text-primary text-bg-primary
            hover:bg-accent
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary
          "
        >
          {continueLabel}
        </button>

        {skipLabel && onSkip && (
          <button
            onClick={onSkip}
            className="
              px-4 py-3 rounded-lg font-medium text-sm
              text-text-secondary
              hover:text-text-primary
              transition-colors duration-200
            "
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Shared input components ─── */

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onEnter?: () => void;
  error?: string;
}

export function TextInput({
  value,
  onChange,
  placeholder,
  onEnter,
  error,
}: TextInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        className={`
          w-full px-4 py-3.5 rounded-lg text-base
          bg-bg-surface text-text-primary
          border ${error ? "border-error" : "border-border-subtle"}
          placeholder:text-text-placeholder
          focus:outline-none focus:border-border-focus
          transition-colors duration-200
        `}
      />
      {error && (
        <p className="mt-2 text-sm text-error">{error}</p>
      )}
    </div>
  );
}

interface TextAreaInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onCmdEnter?: () => void;
  rows?: number;
}

export function TextAreaInput({
  value,
  onChange,
  placeholder,
  onCmdEnter,
  rows = 5,
}: TextAreaInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onCmdEnter) {
      e.preventDefault();
      onCmdEnter();
    }
  };

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="
          w-full px-4 py-3.5 rounded-lg text-base leading-relaxed resize-none
          bg-bg-surface text-text-primary
          border border-border-subtle
          placeholder:text-text-placeholder
          focus:outline-none focus:border-border-focus
          transition-colors duration-200
        "
      />
      <p className="mt-2 text-xs text-text-tertiary">
        Press{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated text-text-secondary text-xs border border-border-subtle">
          {typeof navigator !== "undefined" &&
          /Mac/i.test(navigator.userAgent)
            ? "\u2318"
            : "Ctrl"}
        </kbd>{" "}
        +{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated text-text-secondary text-xs border border-border-subtle">
          Enter
        </kbd>{" "}
        to continue
      </p>
    </div>
  );
}
