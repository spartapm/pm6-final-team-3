# Supabase Social Login Setup

## Project Config

- Project ID: `qwihfnppdhhglxdfajem`
- Supabase URL: `https://qwihfnppdhhglxdfajem.supabase.co`
- Publishable key: stored directly in `src/lib/supabase/client.ts`

This MVP intentionally does not use environment variables for Supabase client config. The browser-safe Supabase URL and publishable key are hardcoded in `src/lib/supabase/client.ts`.

## Implemented In This App

- `@supabase/supabase-js` dependency installed.
- Supabase browser client added at `src/lib/supabase/client.ts`.
- Kakao login button calls `supabase.auth.signInWithOAuth({ provider: "kakao" })`.
- App watches Supabase auth session via `onAuthStateChange`.
- Logout calls `supabase.auth.signOut()`.
- Provided butterfly logo is stored at `public/logo.svg` and used in the UI.
- AI chat calls the server route with `OPENAI_API_KEY` configured in the runtime environment.

## Required Supabase Console Setup

0. Run `supabase/schema.sql` once in the Supabase SQL Editor.
1. Go to Supabase Dashboard > Authentication > URL Configuration.
2. Set Site URL:
   - Local: `http://localhost:3503`
   - Production: deployed service URL
3. Add Redirect URLs:
   - `http://localhost:3503`
   - `http://localhost:3503/**`
   - Production URL
   - Production URL with wildcard if needed
4. Go to Authentication > Providers.
5. Enable the social provider. Current UI is wired for Kakao.
6. Add the provider Client ID and Client Secret from the provider developer console.
7. In the provider developer console, register the Supabase OAuth callback URL:
   - `https://qwihfnppdhhglxdfajem.supabase.co/auth/v1/callback`

## Kakao Developer Console Checklist

- Create or select a Kakao application.
- Enable Kakao Login.
- Add Redirect URI:
  - `https://qwihfnppdhhglxdfajem.supabase.co/auth/v1/callback`
- Copy REST API Key / Client Secret values into Supabase Kakao provider settings.
- Configure consent items needed for the MVP, such as profile nickname.
- The app requests only `profile_nickname profile_image` scopes. It does not request `account_email`.

## What To Ask The Planner / Owner For Kakao Login

Ask for access to the Kakao Developers app or ask them to send:

- Kakao Developers app name
- REST API Key
- Client Secret, if enabled
- Whether Kakao Login is enabled
- Confirmation that this redirect URI is registered:
  - `https://qwihfnppdhhglxdfajem.supabase.co/auth/v1/callback`
- Consent items enabled for login:
  - Profile nickname
  - Profile image, optional
  - Kakao account email is not required for the current MVP
- Production service domain registration:
  - `https://pm6-final-team-3.vercel.app`

## Data Tables Needed Next

`supabase/schema.sql` creates tables with `user_id` linked to `auth.users.id` and enables RLS:

- `profiles`: nickname and basic user metadata
- `memos`: date, title, body, source
- `todos`: date, text, completed
- `schedules`: title, date, start time, end time, color, all-day flag
- `chat_summaries`: raw conversation summary, generated memo/todos/schedule suggestions

Each table should have policies allowing users to select, insert, update, and delete only rows where `user_id = auth.uid()`.
