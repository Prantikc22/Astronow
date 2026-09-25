export type DisplayCurrency = "INR" | "USD";

export function displayCurrency(): DisplayCurrency {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const region = typeof Intl.Locale === "function" ? new Intl.Locale(locale).region : undefined;
    // A device can keep its home locale while travelling; local timezone is the
    // better available signal for reference prices. Checkout uses store pricing.
    if (timeZone) return timeZone === "Asia/Kolkata" || timeZone === "Asia/Calcutta" ? "INR" : "USD";
    return region === "IN" ? "INR" : "USD";
  } catch {
    return "USD";
  }
}

export function localizedReferencePrice(prices?: Record<string, string>): string {
  if (!prices) return "See store";
  return prices[displayCurrency()] || prices.USD || prices.INR || "See store";
}
