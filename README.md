# Elevate UE — Discipleship Group Tracker

A small full-stack app: static HTML/CSS/JS frontend in `public/`, a real
backend in `api/` (Node.js serverless functions), and **Supabase** (a
hosted Postgres database) for real, persistent accounts — no more browser
storage.

## What changed from the old version

- **Real per-user passwords.** Everyone signs up with their own username +
  password (hashed with bcrypt, never stored in plain text). No more shared
  "group password."
- **A real database.** Supabase Postgres, not the browser's storage.
- **DGroup Leader field.** New members pick their leader from a dropdown of
  everyone currently registered as a Leader — or type a name if their leader
  isn't in the system yet.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project (free tier is fine).
2. Once it's created, open **SQL Editor** → **New query**, paste in the
   contents of `supabase-schema.sql` (included in this project), and run it.
   This creates the `profiles` and `events` tables.
3. Go to **Project Settings → API**. You'll need two values from here:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role key** (under "Project API keys" — NOT the `anon` key)
     → this is `SUPABASE_SERVICE_ROLE_KEY`

   ⚠️ The `service_role` key bypasses all database security rules. It must
   only ever live in your hosting provider's server-side environment
   variables — never in frontend code, never committed to GitHub.

## 2. Push this project to GitHub

```bash
git init
git add .
git commit -m "Elevate UE DGM"
gh repo create elevate-ue-dgm --private --source=. --push
```

(Or create a repo on github.com and push manually — just don't commit a
`.env` file; `.gitignore` already excludes it.)

## 3. Deploy (Vercel, connected to your GitHub repo)

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo
   you just created.
2. Vercel auto-detects the `public/` + `api/` layout — no build settings to
   change.
3. Before the first deploy, add three **Environment Variables** (Project
   Settings → Environment Variables):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET` — any long random string (e.g. run
     `openssl rand -hex 32` locally and paste the result)
4. Deploy. Every future `git push` to your main branch auto-redeploys.

## 4. First-time use

The very first account anyone creates should be a **Leader** — pick "Leader"
as the role on signup. After that, the DGroup Leader dropdown on the signup
page will show that name for everyone who joins afterward.

## Project structure

```
public/           the frontend (served as static files)
  index.html
  styles.css
  ue-dgm.js
api/               backend endpoints (Vercel serverless functions)
  auth.js          signup / login / logout / current user
  leaders.js       public list of current Leaders (for the signup dropdown)
  profiles.js      list members, leader adds a member, leader removes one
  campus-time.js   update a person's free days/times
  events.js        list, create, delete events
  rsvp.js          toggle RSVP on an event
lib/               shared server-side helpers
supabase-schema.sql   run this once in Supabase's SQL editor
```

## Security note

This app is appropriately secured for a small trusted group (real hashed
passwords, session cookies, server-side authorization checks on every
write). It has not gone through a professional security review, so treat it
as suitable for internal youth-group use rather than anything handling
sensitive personal data.
