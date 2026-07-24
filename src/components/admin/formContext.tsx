"use client";

import { createContext, useContext } from "react";

/**
 * Field-level errors from the last submit, so inputs can highlight themselves
 * without every form threading an `error` prop down to each field.
 *
 * Lives in its own module because both `ui.tsx` (the fields) and
 * `EntityForm.tsx` (the provider) need it, and importing across those two
 * would be a cycle.
 */
export const FieldErrorContext = createContext<Record<string, string>>({});

export function useFieldError(name: string): string | undefined {
  return useContext(FieldErrorContext)[name];
}
