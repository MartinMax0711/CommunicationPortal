# Huskyteers Portal — FTC 19516

The team communication app for **FTC 19516 The Huskyteers**. Leaders assign tasks, members get a daily checklist, a leader has to approve a checked item before it officially counts, members ask leaders questions, and everyone gets email updates they can switch off.

## What each person can do

| Who | Can do |
|---|---|
| **Member** (Software / Build / Business) | See **Today's checklist** (overdue, due today, coming up) · check items off → *waiting for review* → *approved* (or *needs changes* with the leader's note) · **ask questions** to their subteam leaders, the captain, or a specific person · email preferences |
| **Subteam leader** (Software, Build ×3, Business) | Everything a member can do, plus for **their subteam**: create/edit tasks and assign them to people · **review queue** (approve / send back with a note / bulk approve) · **team progress** (who's done today / this week / 30 days, overdue items) · answer questions |
| **Captain, Mentor, Teacher** | Same as leaders, for **every subteam**, plus whole-team tasks |
| **Admin** (you, the site owner) | **Approve or reject** leaders/captain/mentors/teachers (with seat limits: 1 captain, 1 software, 3 build, 1 business leader) · manage people (change position, disable, send password reset, sign out devices) · **email log** + test email |

Members' accounts work right after sign-up. Leader, captain, mentor, and teacher accounts wait on a "waiting for approval" page until the admin approves them.

**Emails** (each person can turn them off in *Settings*):
- To leaders: a member asks them a question · a member checks off a task they assigned
- To members: someone answers their question · their item is approved or sent back · *(off by default)* they're assigned a new task
- To the admin: someone signs up and needs approval
- Always sent: password reset links, "your password was changed", "you're approved"

## Put it online (about 20 minutes, free tiers)

You need a GitHub account, a [Vercel](https://vercel.com) account (hosting), a [Neon](https://neon.tech) account (Postgres database), and a Gmail account for sending email.

1. **Database — Neon.** Create a project. Copy the **pooled** connection string (the host contains `-pooler`) → this is `DATABASE_URL`. Copy the **direct** (non-pooled) connection string → `DIRECT_URL`.
2. **Email — Gmail.** Turn on 2-Step Verification for the Gmail account, then create an **App Password** (Google Account → Security → App passwords). You'll use: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<the gmail address>`, `SMTP_PASS=<the 16-character app password>`, `EMAIL_FROM="Huskyteers Portal <the gmail address>"`.
   *(Alternative: [Resend](https://resend.com) — set `RESEND_API_KEY` and an `EMAIL_FROM` on a domain you verified there. Its free tier allows 100 emails/day, which a busy 35-person team can exceed; Gmail allows ~500/day.)*
3. **Hosting — Vercel.** Push this repo to GitHub, then *Add New → Project → Import* it. Vercel automatically runs the `vercel-build` script from `package.json`, which applies the database migrations and then builds, so you don't need to change any build settings. Add these **Environment Variables** before the first deploy:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled connection string |
   | `DIRECT_URL` | Neon direct connection string |
   | `APP_URL` | your site URL, e.g. `https://huskyteers-portal.vercel.app` (used in email links) |
   | `ADMIN_EMAILS` | **your** email — the first person to sign up with it (while there is no admin yet) becomes the admin |
   | `TEAM_JOIN_CODE` | a code you'll tell the team (e.g. `go-huskies`) so strangers can't sign up — set this |
   | `TEAM_TIMEZONE` | `America/Los_Angeles` |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | from step 2 |

   Deploy. After you add or change environment variables, redeploy so they take effect.
4. **Become the admin right away:** open the site → *Create an account* with the email you put in `ADMIN_EMAILS`. You land directly in the app with the **Admin** section in the menu. Do this before sharing the link.
5. In **Admin → Email log**, press **Send me a test email** to confirm email works.
6. Share the link and the team code. Members start using it immediately. Approve leaders, mentors, and teachers in **Admin → Approvals** (you also get an email for each one).

> **More admins:** open *Admin → People*, pick the person, tick **Team admin**. (`ADMIN_EMAILS` only creates the *first* admin.)
> **Locked out of admin?** From a computer with this repo and your production `DATABASE_URL` in `.env`, run
> `npm run admin -- --email you@example.com --name "Your Name"`. To just reset someone's password without changing their role: `npm run admin -- --email them@example.com --reset-only`.
> **Someone can't get emails / typo'd their email?** *Admin → People → (person)*: fix the email there. **Forgot password?** Same page → *Send password reset*: the page also shows the one-time link (works once, for 1 hour) so you can send it to them yourself even if email isn't set up.

**Logo:** the husky mark lives in `public/brand/husky-mark.svg` (a redrawn version of the team logo). Replace that file with the original artwork to update it everywhere. Colors are defined once at the top of `src/app/globals.css`.

## Run it on your computer

Requires Node.js 22+. No Docker or database install needed. A real PostgreSQL server runs from `node_modules`.

```bash
npm install
cp .env.example .env          # defaults work for local development
npm run db:start              # terminal 1: local Postgres on port 54329 (keep it running)
npx prisma migrate deploy     # terminal 2: create the tables
npm run db:seed               # demo team: 27 people, tasks, questions (password: huskyteers123)
npm run dev                   # http://localhost:3000
```

Demo sign-ins (password `huskyteers123`): `admin@example.com` (captain + admin), `marcus.johnson@example.com` (build leader), `priya.raman@example.com` (software leader), `maya.patel@example.com` (software member). Without an email server configured, emails are printed in the terminal and recorded in *Admin → Email log*. Reset the demo data with `npm run db:seed -- --reset`.

## Tests

```bash
npm run typecheck && npm run lint
npm test                                   # 355 service/permission/notification tests on real Postgres
npm run build && npm run test:e2e          # 30 browser tests in Chrome (desktop + phone), own database
npm run build && npm run tour              # full-page screenshots of every screen → e2e-artifacts/tour
npm run build && npm start                 # then, in another terminal:
npm run loadtest -- --users 40 --connections 60 --duration 20
```

Load test on a laptop (production build, 40 accounts signed in at once, 60 concurrent connections): **~470 page loads/second with zero errors, p99 ~220 ms**. Leader dashboards: ~260/s, p99 ~300 ms. With a full season of data (~4,750 tasks) every page's database work stays under 15 ms. Real use by 30–40 people is a few requests per second.

## How it's built

Next.js 16 (App Router, Server Components, Server Actions) · React 19 · Tailwind CSS 4 · Prisma 7 + PostgreSQL · zod · Nodemailer / Resend · Vitest · Playwright.

- Architecture, roles and permissions, the checklist state machine, and coding conventions: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).
- Security: scrypt password hashing, server-side sessions (httpOnly cookie, revocable, 30 days), permission checks in every service (never just hidden buttons), Postgres-backed rate limiting on sign-in/sign-up/reset, one-time reset links (1 hour), all user text escaped in pages and emails.
- Reliability: emails send after the response, so a slow mail server never slows the app. Every email attempt is logged. Conditional database writes prevent two leaders from double-reviewing the same item.
