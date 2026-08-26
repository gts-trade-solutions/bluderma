"use client";

import { useEffect, useState } from "react";

import {
  THEME_EVENT,
  applyTheme,
  currentTheme,
  isLightTheme,
  storedPreference,
  type ThemeName,
  type ThemePreference,
} from "@/lib/theme";

/**
 * What the page is currently showing, and how to change it.
 *
 * ── Why it starts as midnight and corrects itself ────────────────────────
 * The server has no idea what this reader chose — the preference lives in
 * their browser — so the first render has to pick something, and picking
 * anything but the app's own default would make every midnight reader hydrate
 * against a mismatched tree. The real value is read in an effect, one frame
 * later.
 *
 * That one frame is not a flash: THEME_BOOTSTRAP has already set the
 * attribute on <html> before anything painted, so the CSS is correct from the
 * first pixel. What is one frame late is only React's knowledge of it, which
 * affects the handful of components that branch on the theme in JavaScript
 * rather than in CSS — the navbar's chrome, essentially.
 */
export function useTheme(): {
  theme: ThemeName;
  /** True for daylight and sepia. What the navbar needs to know. */
  light: boolean;
  preference: ThemePreference;
  setTheme: (p: ThemePreference) => void;
  /** False until the effect has run. Lets a control avoid a wrong first paint. */
  ready: boolean;
} {
  const [theme, setResolved] = useState<ThemeName>("midnight");
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setResolved(currentTheme());
    setPreference(storedPreference());
    setReady(true);

    const onChange = () => setResolved(currentTheme());
    window.addEventListener(THEME_EVENT, onChange);

    // Somebody on "system" who changes their OS setting mid-session should
    // follow it, which is the entire point of that option.
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    const onSystem = () => {
      if (storedPreference() === "system") applyTheme("system");
    };
    mq?.addEventListener?.("change", onSystem);

    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      mq?.removeEventListener?.("change", onSystem);
    };
  }, []);

  return {
    theme,
    light: isLightTheme(theme),
    preference,
    ready,
    setTheme: (p: ThemePreference) => {
      setPreference(p);
      setResolved(applyTheme(p));
    },
  };
}
