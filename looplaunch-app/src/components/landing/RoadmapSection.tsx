"use client";

import { StaggerContainer, StaggerItem } from "@/components/ui/StaggerContainer";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

const ROADMAP_PHASES = [
  {
    period: "30 DAYS",
    title: "Foundation",
    tagline: "Positioning alignment and quick wins",
    actions: [
      "Refine core value proposition and hero messaging",
      "Resolve primary onboarding and conversion friction points",
      "Configure attribution and key funnel metrics",
      "Deploy initial wedge outreach to validated ICP accounts",
    ],
  },
  {
    period: "60 DAYS",
    title: "Growth",
    tagline: "Channel acceleration and inbound loops",
    actions: [
      "Scale highest-ROI acquisition channel identified in diagnosis",
      "Publish authoritative competitor comparisons and teardowns",
      "Deploy self-serve evaluation assets for inbound prospects",
      "Optimize activation workflows and lifecycle sequences",
    ],
  },
  {
    period: "90 DAYS",
    title: "Scale",
    tagline: "Market expansion and category leadership",
    actions: [
      "Establish product-led viral loops and customer referral triggers",
      "Expand into adjacent customer segments and enterprise tiers",
      "Initiate high-signal ecosystem and integration partnerships",
      "Maintain continuous competitor intelligence and market radar",
    ],
  },
];

export function RoadmapSection() {
  return (
    <section className="relative py-32 sm:py-44 px-6 sm:px-8 border-b border-border-subtle bg-bg-primary text-text-primary">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="max-w-2xl mb-20 sm:mb-24">
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
            30 / 60 / 90
          </h2>
          <p className="mt-4 text-text-secondary text-base sm:text-lg leading-relaxed">
            A clear path from strategic decision to execution.
          </p>
        </div>

        {/* Roadmap Columns with Staggered Entrance & Cursor Glow */}
        <StaggerContainer
          staggerDelay={0.12}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8"
        >
          {ROADMAP_PHASES.map((phase) => (
            <StaggerItem key={phase.period} className="h-full">
              <SpotlightCard
                className="h-full flex flex-col p-8 rounded-xl bg-[#0b0b0b] hover:bg-[#0f0f0f] transition-colors"
                radius={380}
                surfaceGlow="rgba(255, 255, 255, 0.05)"
                borderGlow="rgba(255, 255, 255, 0.25)"
              >
                {/* Period marker */}
                <div className="text-xs font-mono tracking-widest text-text-tertiary mb-6 uppercase">
                  {phase.period}
                </div>

                {/* Title & Tagline */}
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary mb-2">
                  {phase.title}
                </h3>
                <p className="text-sm text-text-secondary mb-8 leading-relaxed">
                  {phase.tagline}
                </p>

                {/* Action items */}
                <div className="space-y-4 pt-6 border-t border-border-subtle/50 flex-1">
                  {phase.actions.map((act, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                      <span className="text-text-tertiary font-mono text-xs mt-1 select-none">—</span>
                      <span className="leading-snug text-text-secondary">{act}</span>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

