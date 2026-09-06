"use client";

import { GooeyNav, type GooeyNavItem } from "@/components/ui/GooeyNav";

interface LandingNavProps {
  onGetStarted?: () => void;
}

const NAV_ITEMS: GooeyNavItem[] = [
  { label: "Product", href: "#what-is-it" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Strategy", href: "#strategy-output" },
];

export function LandingNav({ onGetStarted }: LandingNavProps) {
  const scrollToHero = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onGetStarted) {
      onGetStarted();
    } else {
      const heroInput = document.getElementById("hero-website-input");
      if (heroInput) {
        heroInput.scrollIntoView({ behavior: "smooth", block: "center" });
        heroInput.focus();
      }
    }
  };

  const handleNavItemClick = (item: GooeyNavItem) => {
    if (item.href.startsWith("#")) {
      const targetId = item.href.slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-bg-primary/90 backdrop-blur-sm transition-all">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8">
        {/* Brand: Clean, confident typography with zero random dots */}
        <a
          href="#"
          className="text-text-primary select-none font-medium tracking-tight text-sm sm:text-base hover:opacity-90 transition-opacity z-[52]"
        >
          LOOP LAUNCH
        </a>

        {/* Center / Right navigation: GooeyNav integration */}
        <div className="hidden sm:flex items-center z-[51]">
          <GooeyNav
            items={NAV_ITEMS}
            particleCount={10}
            particleDistances={[70, 8]}
            particleR={80}
            initialActiveIndex={0}
            animationTime={450}
            timeVariance={180}
            colors={[1, 2, 3, 1, 2, 3]}
            onItemClick={handleNavItemClick}
          />
        </div>

        {/* Right CTA Button */}
        <div className="flex items-center z-[52]">
          <button
            onClick={scrollToHero}
            className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-text-primary text-bg-primary hover:bg-white transition-colors cursor-pointer"
          >
            Get started
          </button>
        </div>
      </div>
    </header>
  );
}

