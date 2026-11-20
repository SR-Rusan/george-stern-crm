import { brandTokensFor } from '@/config/client';

/** CSS custom properties for a brand accent (used server-side and at runtime). */
export function brandCssVars(accent: string): Record<string, string> {
  const t = brandTokensFor(accent);
  return {
    '--brand-rgb': t.accentRgb,
    '--brand-hover-rgb': t.hoverRgb,
  };
}

/** Applies a brand colour chosen in Settings without a reload. */
export function applyBrandAccent(accent: string | null | undefined): void {
  if (typeof document === 'undefined' || !accent || !/^#[0-9A-Fa-f]{6}$/.test(accent)) return;
  for (const [key, value] of Object.entries(brandCssVars(accent))) {
    document.documentElement.style.setProperty(key, value);
  }
}
