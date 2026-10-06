import * as WebBrowser from "expo-web-browser";

/** Public pages for the store listings (served by the API). */
export const SITE_URL = "https://astronow-api.vercel.app";

export const LINKS = {
  privacy: `${SITE_URL}/privacy`,
  terms: `${SITE_URL}/terms`,
  deleteAccount: `${SITE_URL}/delete-account`,
};

export function openLink(url: string) {
  WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }).catch(() => {});
}
