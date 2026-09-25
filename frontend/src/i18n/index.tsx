import React, { createContext, useContext, useMemo } from "react";

import translations from "@/src/i18n/translations.json";

type Catalog = Record<string, Record<string, string>>;
const catalog = translations as Catalog;
type DynamicEntry = { pattern: RegExp; placeholders: string[]; translated: string };
const dynamicEntries: Record<string, DynamicEntry[]> = {};
const resultCache = new Map<string, string>();

type I18nValue = { language: string; t: (value: string) => string };
const I18nContext = createContext<I18nValue>({ language: "en", t: (value) => value });

export function translateText(value: string, language: string): string {
  if (!value || language === "en") return value;
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const key = value.trim();
  if (!key) return value;
  // JSX source can add indentation/newlines around the same sentence that is
  // stored as one line in the catalog.
  const exact = catalog[language]?.[key] || catalog[language]?.[key.replace(/\s+/g, " ")];
  if (exact) return leading + exact + trailing;

  const cacheKey = `${language}\u0000${key}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return leading + cached + trailing;
  if (!dynamicEntries[language]) {
    dynamicEntries[language] = Object.entries(catalog[language] || {}).flatMap(([source, translated]) => {
      const normalizedSource = source.replace(/\s+/g, " ").trim();
      const placeholders = [...normalizedSource.matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1]);
      if (!placeholders.length) return [];
      // A template with no meaningful fixed text can match almost any UI string.
      // Keep interpolation for sentences, not source-code fragments or bare values.
      if (normalizedSource.replace(/\$\{[^}]+\}/g, "").trim().length < 3 || normalizedSource.includes("${${")) return [];
      const pattern = normalizedSource
        .split(/\$\{[^}]+\}/g)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("(.+?)");
      return [{ pattern: new RegExp(`^${pattern}$`, "s"), placeholders, translated }];
    });
  }
  for (const entry of dynamicEntries[language]) {
    const match = key.replace(/\s+/g, " ").match(entry.pattern);
    if (!match) continue;
    let resolved = entry.translated;
    entry.placeholders.forEach((placeholder, index) => {
      resolved = resolved.split(`\${${placeholder}}`).join(match[index + 1]);
    });
    resultCache.set(cacheKey, resolved);
    return leading + resolved + trailing;
  }
  resultCache.set(cacheKey, key);
  return value;
}

export function I18nProvider({ language = "en", children }: { language?: string; children: React.ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ language, t: (text) => translateText(text, language) }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function translateChildren(children: React.ReactNode, t: (value: string) => string): React.ReactNode {
  if (typeof children === "string") return t(children);
  if (Array.isArray(children)) return children.map((child) => translateChildren(child, t));
  return children;
}
