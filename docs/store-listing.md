# AstroNow store listing

Copy for App Store Connect and Google Play Console. Review before pasting.

## Basics

| Field | Value |
| --- | --- |
| App name | AstroNow: Kundli & Astrology |
| Subtitle (iOS, 30 chars) | Your stars, read for today |
| Short description (Play, 80 chars) | Kundli, daily horoscope and a 24x7 Astrologer, based on your exact birth chart. |
| Category | Lifestyle (secondary: Entertainment) |
| Bundle ID / package | com.prantik.astronow |
| Privacy Policy URL | https://astronow-api.vercel.app/privacy |
| Terms of Use (EULA) URL | https://astronow-api.vercel.app/terms |
| Account deletion URL (Play) | https://astronow-api.vercel.app/delete-account |
| Support URL | https://astronow-api.vercel.app/privacy (replace with a support page or email when you have one) |
| Age rating | 12+ (iOS: "Infrequent/Mild Mature/Suggestive Themes": none; astrology counts as no restricted content). Play: Everyone / IARC questionnaire, no violence, no user-to-user chat. |

Keywords (iOS, 100 chars):
`kundli,horoscope,vedic,astrology,birth chart,panchang,muhurat,tarot,numerology,vastu,zodiac,rashi`

## Description

Your stars, read for today.

AstroNow turns your exact birth chart into clear, practical guidance. Vedic astrology, explained in plain language, for India and for curious minds everywhere.

TODAY, FOR YOU
• A daily reading written from your own chart and today's planets, not a generic sun-sign horoscope
• Energy for love, work, money and health, with the best times of the day
• Panchang, moon phase and a moon calendar with fasting days

YOUR KUNDLI, EXPLAINED
• Full birth chart (North Indian style) with planets, houses and nakshatras
• Your current Dasha period and what it means for you
• Yogas and doshas, explained calmly and without fear

ASK THE 24x7 ASTROLOGER
• Ask anything about career, relationships, timing or family
• Answers are based on your chart, in 9 languages including Hindi, Bengali, Tamil and Telugu

MORE TOOLS
• Kundli matching and compatibility
• Muhurat finder for travel, property, a new job or a wedding
• Vastu report: draw or upload your floor plan
• Numerology and tarot
• Family profiles

ASTRONOW PLUS
Unlock every personal report, more daily questions and the full depth of your chart. Plus is an auto-renewing subscription; cancel any time in your store settings. Question packs and single reports are also available without a subscription.

Astrology is for reflection and guidance. It is not medical, legal or financial advice.

## App Review notes (iOS) / App access (Play)

Reviewers cannot receive Indian SMS codes, so give them an email account:

> Sign in with email: tap "Continue with email", then "Have an account? Sign in".
> Email: <create a review account and put it here>
> Password: <its password>
> The account already has a birth profile so all screens load. To test purchases use a Sandbox (iOS) or licence-tester (Play) account.

Create this account yourself in the app (email sign-up), complete onboarding once, then paste the details above.

## Data safety (Play) / App privacy (iOS)

Data collected, linked to the user, not used for tracking, not sold:

| Data | Purpose |
| --- | --- |
| Phone number, email address | Account management, app functionality |
| Name (first name) | App functionality, personalisation |
| Other info: birth date, time and place | App functionality, personalisation |
| User content: questions to the Astrologer | App functionality |
| Purchase history | App functionality |
| App interactions (screens opened) | Analytics |
| Photos (only a floor plan the user picks, not stored as a photo library) | App functionality |

Data is encrypted in transit (HTTPS). Users can request deletion in the app (Profile, then Delete my account) and at the deletion URL above. No data is shared with third parties for their own use; service providers process it on our behalf.

iOS tracking: No (the app does not track users across other companies' apps or websites).

## In-app products to create (same IDs in both stores and RevenueCat)

| Product ID | Type | Price (India / US) |
| --- | --- | --- |
| premium_monthly | Auto-renewing subscription, 1 month | ₹299 / $7.99 |
| premium_annual | Auto-renewing subscription, 1 year | ₹2,499 / $49.99 |
| questions_10 | Consumable | ₹199 / $2.99 |
| questions_30 | Consumable | ₹449 / $5.99 |
| report_match | Non-consumable | ₹249 / $2.99 |
| report_artha_strategy | Non-consumable | ₹299 / $3.99 |
| report_12_year_compass | Non-consumable | ₹399 / $4.99 |

In RevenueCat: one entitlement for Plus (attach both subscriptions), and a "default" offering whose packages are the monthly and annual subscriptions plus the question packs and reports (package identifiers should contain the product id, e.g. `questions_10`).

Put both subscriptions in one subscription group ("AstroNow Plus") and attach them to the RevenueCat entitlement used by the app.

## Screenshots

Needed: iPhone 6.9" (1320×2868), Android phone (1080×1920 or larger). Suggested five: Welcome, Today, Kundli chart, 24x7 Astrologer chat, Reports.
