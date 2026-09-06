# Directive: Build Loop Launch Onboarding Frontend

## Goal
Create a premium, conversational multi-step onboarding UI for Loop Launch.
Frontend only — no AI pipeline, no backend, no database.

## Inputs
- Product brief (provided by user)
- Visual direction: black/white, minimal, premium, doodle bird mascot
- Tech stack: Next.js 15 + React + TypeScript + Tailwind CSS + shadcn/ui

## Execution Steps

### Phase 1: Scaffold
1. Initialize Next.js project at repo root
2. Install and configure shadcn/ui
3. Set up design tokens (colors, typography, spacing)
4. Generate mascot asset

### Phase 2: Data Layer
1. Create `src/lib/onboarding/types.ts` — typed OnboardingData interface
2. Create `src/lib/onboarding/validation.ts` — URL validation, optional field handling
3. Create `src/lib/onboarding/context.tsx` — React context + provider, sessionStorage persistence

### Phase 3: Components
1. `OnboardingShell` — full-screen container, branding, mascot, step transitions
2. `OnboardingProgress` — minimal step counter (01/07)
3. `OnboardingQuestion` — reusable question wrapper with keyboard support
4. 7 step components (Website, Company, Audience, Competitors, Goal, Marketing, Constraints)
5. `ReviewStep` — displays all answers, edit actions, "Start analysis" CTA
6. `Mascot` — renders bird with subtle float animation

### Phase 4: Pages
1. `src/app/page.tsx` — renders onboarding flow
2. `src/app/ready/page.tsx` — placeholder workspace-ready page

### Phase 5: Polish & Verify
1. `npm run build` — fix TypeScript/build errors
2. `npm run dev` — walk through complete flow
3. Fix responsiveness, keyboard, validation, animation issues

## Outputs
- Working onboarding flow at localhost
- Clean OnboardingData object ready for future API submission
- Placeholder "workspace ready" page for future pipeline connection

## Phase 6: Landing Page & Onboarding Hero Redesign
1. Integrated `<Ferrofluid />` WebGL fluid background component with `ogl` in the Hero section.
2. Architectural design: when `currentStepIndex === 0`, `OnboardingShell` renders `LandingPage` (hosting the Hero input, 10 narrative sections, and Final CTA).
3. Both Hero input and Final CTA input synchronize with `useOnboarding()` state and trigger transition to Step 2 (`CompanyStep`).
4. Clicking `← Back` from Step 2 seamlessly returns the user to the landing page with pre-filled URL.
5. Added contextual Mascot variants (`hero`, `research`, `strategy`, `cta`, `default`).

## Edge Cases & Learnings
- **WebGL SSR safety**: When using `ogl` inside Next.js App Router, ensure `"use client"` is set and guard against zero-dimension canvas or unsupported WebGL contexts.
- **CSS Property Syntax in Tailwind v4**: Standard CSS rules in `globals.css` must use `pointer-events: none;` rather than Tailwind utility names like `pointer-events-none;`.
- **Seamless Flow Continuity**: Rather than a separate landing page route, hosting the Landing Page at Step 0 inside `OnboardingShell` preserves session persistence, back navigation, and instantaneous transitions without URL route redirects.

