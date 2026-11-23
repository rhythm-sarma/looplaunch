"use client";

import { useSyncExternalStore } from "react";

/**
 * The analysis menu's two shapes. From WIDE up it's a sidebar that stays open beside the chat
 * (open at first; ☰ closes and reopens it, and the choice is remembered). Below WIDE there isn't
 * room for that, so ☰ slides it over the page instead.
 */
export const WIDE_QUERY = "(min-width: 1280px)";
export const SIDEBAR_WIDTH = 272;

const KEY = "ll-menu-docked";
const listeners = new Set<() => void>();
// The choice made in this tab, so it still toggles where storage is blocked.
let current: boolean | null = null;

function readDocked(): boolean {
  if (current !== null) return current;
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

function subscribeDocked(onChange: () => void) {
  // Another tab opened or closed it: read the stored choice again.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = null;
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setDocked(docked: boolean) {
  current = docked;
  try {
    localStorage.setItem(KEY, docked ? "1" : "0");
  } catch {
    // Private mode: it still toggles for this page view.
  }
  listeners.forEach((l) => l());
}

/** Whether the sidebar is open on wide screens. Open unless the person closed it; the server assumes open. */
export function useMenuDocked(): [boolean, (docked: boolean) => void] {
  const docked = useSyncExternalStore(subscribeDocked, readDocked, () => true);
  return [docked, setDocked];
}

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on screens wide enough for the sidebar. */
export function useIsWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
}
