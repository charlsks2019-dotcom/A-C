# A&C

A private, two-person space for goals, progress, feed posts, and chat — with real photo uploads.
Built with Next.js + Supabase. Free to run at this scale, no credit card required.

---

## What you're setting up

- **Supabase** — free database + free file storage + free real-time sync
- **Vercel** — free hosting, gives you a real URL, installable on your phone home screen
- Total cost: **$0/month** for two people using it normally

---

## Step 1 — Create your Supabase project (5 min)

1. Go to https://supabase.com → sign up (free, no card needed) → **New project**
2. Pick any name/region, set a database password (save it somewhere), wait ~2 min for it to spin up
3. In the left sidebar, go to **SQL Editor → New query**
4. Open `supabase-schema.sql` from this project, copy all of it, paste into the editor, click **Run**
   - This creates all your tables and a `media` storage bucket for photos
5. Go to **Settings → API** in the sidebar. You'll need two values from here in Step 3:
   - **Project URL**
   - **anon public** key

---

## Step 2 — Get the code running locally (optional but recommended first)

You'll need [Node.js](https://nodejs.org) installed (free).

```bash
cd ac-app
npm install
cp .env.local.example .env.local
```

Open `.env.local` and paste in your Supabase URL and anon key from Step 1.
Optionally set `NEXT_PUBLIC_APP_PASSCODE` to any word/phrase — this puts a simple lock screen in front of the app so randoms can't stumble onto your link.

```bash
npm run dev
```

Open http://localhost:3000 — you should see the app. Set up both your names, add a goal, post something with a photo, and confirm it saves.

---

## Step 3 — Deploy for free on Vercel (10 min)

1. Push this folder to a GitHub repo (create a free GitHub account if you don't have one)
2. Go to https://vercel.com → sign up free with your GitHub account
3. Click **Add New → Project**, pick your repo, click **Import**
4. Before deploying, add your environment variables (same ones from `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_PASSCODE` (optional)
5. Click **Deploy**. In about a minute you'll get a live URL like `ac-app-yourname.vercel.app`

Send that link to your partner. Open it on both your phones, tap **Share → Add to Home Screen** (iOS) or use the browser menu **Install app** (Android) — it'll behave like a real app icon.

---

## Privacy notes, honestly

- The app is only accessible to people who have your link (and passcode, if you set one). It isn't listed or discoverable anywhere.
- Data lives in your own private Supabase project — Anthropic/Claude has no access to it once deployed.
- The database currently allows read/write to anyone holding the anon key (which is embedded in the app's public code, standard for small apps like this). That's fine for a private link only the two of you know — but if you ever want stronger protection (real login instead of a shared passcode), that's a reasonable next upgrade and worth asking for.
- Photos are stored in a public (but unlisted) Supabase Storage bucket — anyone with the exact photo URL could view it, but URLs aren't guessable or indexed anywhere.

---

## What's already built in

- **Feed** — post text and/or a photo, optionally tag it to a goal; likes and comments, live-synced between you two
- **Goals** — daily/weekly/monthly, by category, streak tracking, auto-posts a feed update when you check in
- **Chat** — real-time messaging, synced instantly via Supabase Realtime
- **Profile** — check-in counts, best streaks, post counts for both of you side by side

## Free tier limits (won't matter at your scale)

- Supabase free tier: 500MB database, 1GB file storage, 50k monthly active users
- Vercel free tier: 100GB bandwidth/month
- You'd need thousands of times your actual usage to hit either limit
