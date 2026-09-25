# AstroNow

AstroNow is a cross-platform Vedic astrology and spiritual-reflection product built with Expo, React Native, FastAPI, Supabase, Skyfield, OpenRouter and RevenueCat.

The product uses deterministic code for astrological, numerological and Vastu calculations. AI is used only to explain already-computed structured facts; it is never the mathematical source of truth.

## What is here

- `frontend/` — Expo Router app for iOS, Android and web
- `backend/` — FastAPI API, Supabase Auth bridge, Postgres data layer and AI gateway
- `backend/astro/` — deterministic natal chart, dasha, transit, Panchang, compatibility, numerology, Tarot and Vastu engines
- `backend/migrations/` — Postgres schema and row-level security policies
- `backend/tests/` — deterministic engine fixtures and API integration tests

The mobile app includes onboarding, Google Places birthplace/timezone lookup, Today, birth chart, life periods, transits, Panchang, personalized AI prompt suggestions and streaming chat history, Love/Marriage/Friendship/Business compatibility, a categorized report library, Tarot, numerology, Vastu upload/drawing, subscription UI, terminology modes, privacy controls and account deletion.

## Product and visual system

The app uses the original **Twilight Observatory** direction: hand-painted midnight environments, indigo ink, aubergine, warm ivory, saffron and rose; Fraunces editorial headings; Nunito Sans interface copy; rounded Phosphor duotone icons; fixed card geometry; and restrained spring/fade motion. The accent system intentionally avoids green.

Ask has one consistent guide, **Tara** ("star"). She is clearly identified as AI-powered, speaks in a warm, grounded voice, and interprets the deterministic chart rather than inventing planetary facts. Her fictional, photorealistic portrait is in `frontend/assets/images/guides/tara.png`.

The AstroNow aperture mark combines an eye, orbit and north-star spark. Its editable source is `frontend/assets/images/brand/astronow-aperture.svg`; store icon, adaptive icon and splash outputs live beside it. The design takes cues from editorial calm and personal daily guidance without copying the supplied reference apps or their artwork.

The product uses a hybrid model: the daily sky, basic chart, a report preview and 10 Tara messages per calendar month are free. AstroNow Plus targets ₹299/month or ₹1,999/year (reference prices, not live store offers), with the reusable core report library, up to 40 messages per rolling day and deeper interpretations. Signature one-time reports display a transparent 50% launch discount: Match Report ₹249 (₹498 list), Artha Strategy ₹299 (₹598 list), and the 12-Year Compass ₹399 (₹798 list). One birth-detail correction is included and enforced by the API. The legacy lifetime tier remains recognized for existing owners, but is no longer offered because AI usage has ongoing costs.

## Quick UI preview with Expo Go

```bash
cd frontend
npm install
cp .env.example .env
# Set EXPO_PUBLIC_PREVIEW_MODE=1 for seeded development data.
npx expo start --go --lan
```

Preview mode is guarded by both `EXPO_PUBLIC_PREVIEW_MODE=1` and Expo's `__DEV__` constant. It cannot activate in a release bundle. It exists so designers and engineers can exercise every major screen before a shared Supabase database is connected.

## Production mobile configuration

Copy `frontend/.env.example` to `frontend/.env` and configure:

- `EXPO_PUBLIC_BACKEND_URL` — public HTTPS origin of the FastAPI service
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public mobile publishable/anon key
- `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=0` — keep Google sign-in as a clearly marked placeholder until provider setup is complete
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` — RevenueCat Apple public SDK key
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` — RevenueCat Google public SDK key
- `EXPO_PUBLIC_PREVIEW_MODE=0`

Never add a Supabase service-role key, OpenRouter key, database URL or RevenueCat secret key to any `EXPO_PUBLIC_*` variable.

Run the app:

```bash
cd frontend
npm run ios
npm run android
npm run web
```

RevenueCat supports a JavaScript preview API in Expo Go. Real App Store and Play Store purchases require a development build:

```bash
cd frontend
npx expo run:ios
npx expo run:android
```

Google sign-in is prepared for both account creation and sign-in but is off by default. To activate it, configure Google as a Supabase Auth provider with a Google OAuth client ID and secret; allow `astronow://auth/callback` and the web `/auth/callback` URL in Supabase redirect settings; then set `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=1` and create a development build. Google OAuth redirect and the app's native splash cannot be validated in Expo Go. The Supabase Google callback URL must also be configured in Google Cloud as directed by Supabase.

Products and the `premium` entitlement must be created in RevenueCat and mapped to the Apple/Google products. The subscription product identifiers should match `monthly` and `annual`; one-time products should be searchable as `report_match`, `report_artha_strategy`, and `report_12_year_compass`. Store-localized prices are read from the RevenueCat offering; the prices in server config are display-only fallbacks.

## Backend setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Required production values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server only
- `OPENROUTER_API_KEY` — server only
- `REVENUECAT_SECRET_KEY` — server-side entitlement verification key
- `ADMIN_TOKEN` — long random server-side admin credential
- `GOOGLE_PLACES_API_KEY`

Optional model routing variables are `AI_MODEL_FAST`, `AI_MODEL_STANDARD`, `AI_MODEL_DEEP` and `AI_MODEL_VISION`. CORS browser origins are a comma-separated `CORS_ORIGINS` list.

The backend reads and writes through Supabase's generated Data API; no separate database URL is required. Apply the SQL files in `backend/migrations` once through the Supabase SQL Editor when creating a fresh project.

## Supabase and privacy

The schema enables RLS on every user-owned table. Authenticated mobile clients may read only their own rows; writes go through the backend so birth-detail limits and entitlements cannot be bypassed through Supabase REST. The backend also includes `user_id` in every private query. The service-role key is only for server-side operations and must never be shipped in the mobile bundle.

Sensitive records include birth details, chats, relationship profiles and home layouts. Delete operations scope by authenticated user. Analytics records event names and operational metadata, never chat text.

## AI architecture

The server selects only question-relevant context from the natal chart, active dasha, transits, Panchang and conversation summary. OpenRouter calls happen exclusively in `backend/ai_gateway.py`, which tracks model, token counts and estimated cost.

The gateway supports separate fast, standard, deep and vision models. Structured vision output is JSON-validated before it becomes a user-confirmable floor-plan proposal. The user must set North and confirm detected rooms before deterministic Vastu analysis runs.

## Tests and health checks

```bash
cd backend
.venv/bin/pytest -q tests/test_astro.py

cd ../frontend
npx tsc --noEmit
npm run lint
npx expo-doctor
```

`backend/tests/test_api.py` is an environment integration suite. Point `EXPO_PUBLIC_BACKEND_URL` at a configured backend before running it.

## Deployment checklist

1. Rotate any credential that has been shared outside its intended secret manager.
2. Apply the Supabase migrations in the SQL Editor.
3. Restrict the Google Places key to the correct APIs, apps and origins.
4. Configure OpenRouter model IDs and spending limits.
5. Configure RevenueCat products, offering, entitlements and secret verification key.
6. Set a strong `ADMIN_TOKEN` and explicit `CORS_ORIGINS`.
7. Set `EXPO_PUBLIC_PREVIEW_MODE=0` and use an HTTPS backend.
8. Run deterministic tests, TypeScript, lint and Expo Doctor.
9. Build signed store binaries and test purchase/restore in sandbox accounts.

AstroNow provides astrology and spiritual reflection, not medical, legal or financial advice.
