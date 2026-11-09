import { useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

// Remembers that the AI data-sharing question was answered on this device, so "Not now" isn't asked again on every launch.
const ASKED_KEY = "astronow.ai_consent_asked";

export async function markAiConsentAsked() {
  await storage.setItem(ASKED_KEY, true);
}

/** null while loading, then whether this device has already shown the consent question. */
export function useAiConsentAsked() {
  const [asked, setAsked] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    storage.getItem(ASKED_KEY, false).then((value) => { if (live) setAsked(!!value); });
    return () => { live = false; };
  }, []);
  return asked;
}
