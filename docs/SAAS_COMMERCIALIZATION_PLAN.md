# AVAS SaaS Commercialization Plan

> Branch: `saas-commercial`
> Last updated: 2026-03-19
> Status: Planning — not yet started

This document is the single source of truth for turning AVAS from an internal tool into a
commercial SaaS product. Work through each phase in order. Do not start a phase until all
tasks in the previous phase are marked done.

---

## Quick Reference

### API Cost Reality Check
| Operation | Model | API Cost |
|-----------|-------|---------|
| Image generation | Gemini 2.5 Flash | $0.039/image |
| Video | Veo 3.1 Fast | $0.15/sec → 5s = $0.75 |
| Video | Veo 3.1 Standard | $0.40/sec → 8s = $3.20 |
| Video | Kling 2.6 Standard | $0.20 (5s) / $0.40 (10s) |
| Video | Kling 2.6 Pro | $0.33 (5s) / $0.66 (10s) |

> ⚠️ `gemini-2.0-flash-preview-image-generation` is deprecated — shuts down **June 1, 2026**.
> Must migrate to `gemini-2.5-flash` or Imagen 4 before Phase 1 is complete.

### Subscription Tiers
| Tier | Price | Credits/mo | Seats | Rollover |
|------|-------|-----------|-------|----------|
| Starter | $29/mo | 600 | 1 | None |
| Professional | $79/mo | 2,000 | 1 | Up to 50% |
| Studio | $199/mo | 6,000 | 5 | Up to 50% |
| Enterprise | Custom | Unlimited | Unlimited | Custom |

**Signup bonus:** 20 credits on account creation, usable on `render-3d` and `render-cad` only. Never refills.

### Credit Costs Per Operation (1 credit = $0.05)
| Operation | Credits | API Cost | Price | Margin |
|-----------|---------|---------|-------|--------|
| Image render (all modes) | 2 | $0.039 | $0.10 | 61% |
| Upscale | 1 | $0.020 | $0.05 | 60% |
| PDF compression | 1 | $0.005 | $0.05 | 90% |
| Document translation | 5 | $0.100 | $0.25 | 60% |
| Material validation | 8 | $0.150 | $0.40 | 62% |

### Video Pricing (Pay-Per-Generation via Stripe)
| Model | Duration | API Cost | Charge | Margin |
|-------|---------|---------|--------|--------|
| Kling Standard | 5s | $0.20 | $0.25 | 20% |
| Kling Standard | 10s | $0.40 | $0.50 | 20% |
| Kling Pro | 10s | $0.66 | $0.85 | 22% |
| Veo 3.1 Fast | 5s | $0.75 | $0.95 | 21% |
| Veo 3.1 Standard | 8s | $3.20 | $3.99 | 20% |

### Mode Access by Tier
| Mode Group | Signup Bonus | Starter | Professional | Studio/Enterprise |
|------------|-------------|---------|-------------|-------------------|
| render-3d, render-cad | ✓ | ✓ | ✓ | ✓ |
| render-sketch, section, exploded, multi-angle, masterplan | — | ✓ | ✓ | ✓ |
| visual-edit, upscale, headshot, generate-text | — | ✓ | ✓ | ✓ |
| img-to-cad, img-to-3d | — | — | ✓ | ✓ |
| document-translate, material-validation, pdf-compression | — | — | ✓ | ✓ |
| video (pay-per-gen) | — | ✓ | ✓ | ✓ |
| Team management, shared credit pool | — | — | — | ✓ |

---

## Phase 1 — Foundation: Database, Auth & API Gateway

> Everything else depends on this phase. No UI work starts until this is done.

### 1.1 Supabase Project Setup
- [ ] Create Supabase project (choose region closest to majority of users)
- [ ] Enable Google OAuth provider in Supabase Auth dashboard
  - Add Google Cloud OAuth 2.0 credentials (client ID + secret)
  - Set authorized redirect URI to Supabase callback URL
- [ ] Enable Email provider in Supabase Auth dashboard
  - Configure email confirmation flow
  - Set up custom SMTP via Resend (see Phase 6 for Resend setup)
- [ ] Store Supabase project URL and anon key in `.env.local`
  ```
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  ```

### 1.2 Database Schema
Run the following migrations in order via Supabase SQL editor or migration files.

#### Migration 001 — Core user and org tables
```sql
-- Users (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'superadmin')),
  plan text not null default 'unsubscribed' check (plan in ('unsubscribed', 'starter', 'professional')),
  credits int not null default 0,
  signup_bonus_remaining int not null default 20,
  stripe_customer_id text unique,
  suspended_at timestamptz,
  created_at timestamptz not null default now()
);

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users(id),
  plan text not null default 'studio' check (plan in ('studio', 'enterprise')),
  credits int not null default 0,
  seat_limit int not null default 5,
  extra_credits_purchased int not null default 0,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now()
);

-- Organization members
create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Organization invites
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references public.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
```

#### Migration 002 — Subscriptions and billing
```sql
-- Subscriptions (covers both individual users and orgs)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user', 'org')),
  entity_id uuid not null,
  stripe_subscription_id text unique not null,
  plan text not null,
  status text not null,
  credits_per_period int not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Video charges (pay-per-generation)
create table public.video_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  org_id uuid references public.organizations(id),
  model text not null,
  duration_seconds int not null,
  amount_cents int not null,
  stripe_payment_intent_id text unique,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

-- Credit top-up purchases
create table public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user', 'org')),
  entity_id uuid not null,
  credits_purchased int not null,
  amount_cents int not null,
  stripe_payment_intent_id text unique,
  created_at timestamptz not null default now()
);
```

#### Migration 003 — Usage and admin audit
```sql
-- Usage log (every generation)
create table public.usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  org_id uuid references public.organizations(id),
  mode text not null,
  credits_used int not null,
  used_bonus boolean not null default false,
  created_at timestamptz not null default now()
);

-- Manual credit adjustments by superadmin
create table public.credit_adjustments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user', 'org')),
  entity_id uuid not null,
  amount int not null,
  reason text not null,
  performed_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);
```

#### Migration 004 — Row Level Security policies
```sql
-- Users: can only read/update own row
alter table public.users enable row level security;
create policy "users_own" on public.users
  for all using (auth.uid() = id);
create policy "superadmin_all_users" on public.users
  for all using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin'));

-- Organizations: members can read, owner/admin can update
alter table public.organizations enable row level security;
create policy "org_members_read" on public.organizations
  for select using (exists (
    select 1 from public.organization_members om
    where om.org_id = id and om.user_id = auth.uid()
  ));
create policy "org_owner_admin_write" on public.organizations
  for update using (exists (
    select 1 from public.organization_members om
    where om.org_id = id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
  ));

-- Organization members: members can read, admins can insert/delete
alter table public.organization_members enable row level security;
create policy "org_members_read" on public.organization_members
  for select using (exists (
    select 1 from public.organization_members om
    where om.org_id = org_id and om.user_id = auth.uid()
  ));
create policy "org_admin_write" on public.organization_members
  for all using (exists (
    select 1 from public.organization_members om
    where om.org_id = org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
  ));

-- Usage log: users see own, org admins see org usage
alter table public.usage_log enable row level security;
create policy "usage_own" on public.usage_log
  for select using (user_id = auth.uid());
create policy "usage_org_admin" on public.usage_log
  for select using (exists (
    select 1 from public.organization_members om
    where om.org_id = usage_log.org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
  ));

-- Video charges: own only
alter table public.video_charges enable row level security;
create policy "video_charges_own" on public.video_charges
  for select using (user_id = auth.uid());

-- Superadmin bypass for all tables
-- (add similar superadmin policies to each table as above)
```

#### Migration 005 — Helper functions
```sql
-- Atomically deduct credits (returns false if insufficient)
create or replace function deduct_credits(
  p_entity_type text,
  p_entity_id uuid,
  p_amount int
) returns boolean language plpgsql security definer as $$
begin
  if p_entity_type = 'user' then
    update public.users
    set credits = credits - p_amount
    where id = p_entity_id and credits >= p_amount;
  elsif p_entity_type = 'org' then
    update public.organizations
    set credits = credits - p_amount
    where id = p_entity_id and credits >= p_amount;
  end if;
  return found;
end;
$$;

-- Award signup bonus credits
create or replace function award_signup_bonus()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, signup_bonus_remaining, credits)
  values (new.id, new.email, 20, 20)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function award_signup_bonus();

-- Reset credits on subscription renewal
create or replace function reset_credits_on_renewal(
  p_entity_type text,
  p_entity_id uuid,
  p_credits_per_period int,
  p_rollover_cap_pct float default 0.5
) returns void language plpgsql security definer as $$
declare
  current_credits int;
  rollover int;
begin
  if p_entity_type = 'user' then
    select credits into current_credits from public.users where id = p_entity_id;
    rollover := least(current_credits, floor(p_credits_per_period * p_rollover_cap_pct));
    update public.users set credits = p_credits_per_period + rollover where id = p_entity_id;
  elsif p_entity_type = 'org' then
    select credits into current_credits from public.organizations where id = p_entity_id;
    rollover := least(current_credits, floor(p_credits_per_period * p_rollover_cap_pct));
    update public.organizations set credits = p_credits_per_period + rollover where id = p_entity_id;
  end if;
end;
$$;
```

### 1.3 Cloudflare Worker — Auth Swap & Credit Gate

- [ ] Add Supabase JWT secret to Worker secrets (`SUPABASE_JWT_SECRET`)
- [ ] Remove `ALLOWED_DOMAIN` and Google ID token verification logic entirely
- [ ] Replace with Supabase JWT verification:
  - Decode and verify JWT using `SUPABASE_JWT_SECRET`
  - Extract `sub` (user UUID) and `email` from JWT claims
- [ ] Add credit check endpoint logic:
  - Before every API proxy call, call Supabase REST API to invoke `deduct_credits()`
  - If returns false → return `402 Payment Required` to client
  - If user is `suspended_at IS NOT NULL` → return `403 Forbidden`
- [ ] Add bonus-credit mode gate:
  - If user has no subscription (`plan = 'unsubscribed'`), only allow `render-3d` and `render-cad`
  - Deduct from `signup_bonus_remaining` first, then `credits`
- [ ] Add Stripe webhook handler endpoint (`POST /webhooks/stripe`):
  - `customer.subscription.created` → set plan + award credits
  - `customer.subscription.updated` → update plan + adjust credits
  - `customer.subscription.deleted` → set plan to `unsubscribed`
  - `invoice.paid` → call `reset_credits_on_renewal()`
  - `payment_intent.succeeded` → update `video_charges.status = 'succeeded'`
  - `payment_intent.payment_failed` → update `video_charges.status = 'failed'`
- [ ] Add video pre-auth endpoint (`POST /api/video/charge`):
  - Create Stripe Payment Intent for the appropriate video price
  - Insert row in `video_charges` with status `pending`
  - Return `client_secret` to frontend for Stripe.js confirmation
  - Only proxy to Veo/Kling after receiving `payment_intent.succeeded` webhook
- [ ] Add Worker secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`

### 1.4 Gemini Model Migration
- [ ] Audit all references to `gemini-2.0-flash-preview-image-generation` in `services/geminiService.ts` and `engine/promptEngine.ts`
- [ ] Replace with `gemini-2.5-flash` (or Imagen 4 where applicable)
- [ ] Test all 18 generation modes still produce correct output after migration
- [ ] Deadline: before June 1, 2026

---

## Phase 2 — Authentication & Onboarding

### 2.1 Install & Configure Supabase Client
- [ ] `npm install @supabase/supabase-js`
- [ ] Create `lib/supabaseClient.ts` — initialize client with env vars
- [ ] Create `lib/auth.ts` — typed wrappers for sign in, sign up, sign out, get session

### 2.2 Replace AuthGate Component
- [ ] Rewrite `components/auth/AuthGate.tsx`:
  - Remove Google Identity Services library (`accounts.google.com/gsi/client`)
  - Remove current JWT-in-memory logic
  - Replace with `supabase.auth.onAuthStateChange()` listener
  - Supabase session is stored automatically in localStorage by the SDK
- [ ] Build auth screen with two tabs:
  - **Sign In**: Google button + email/password form + "Forgot password" link
  - **Sign Up**: Google button + email/password form + name field
- [ ] Handle email confirmation flow (show "check your email" state)
- [ ] Handle password reset flow (link from email → set new password screen)
- [ ] Pass Supabase JWT to Cloudflare Worker in `Authorization: Bearer` header (replaces old JWT)

### 2.3 User Profile Sync
- [ ] On first sign-in, upsert user record in `public.users` from auth metadata
- [ ] Sync `name` and `avatar_url` from Google OAuth profile on each login
- [ ] Store current user in a React context (or extend Zustand store)

### 2.4 Signup Bonus & Mode Gates
- [ ] On first load after signup, show welcome modal:
  - Explain the 20 bonus credits
  - Explain which modes are available (render-3d, render-cad)
  - Show CTA to subscribe for full access
- [ ] Gate locked modes in UI:
  - Modes unavailable on current plan show a lock badge in `TopBar` mode switcher
  - Clicking a locked mode opens an upgrade modal instead of switching
  - Mode gates read from user's `plan` and `signup_bonus_remaining` in store
- [ ] Credit balance widget in `TopBar`:
  - Show current credit balance (pull from Supabase on load, update optimistically on generation)
  - Low credit warning (< 20 credits): amber indicator
  - Zero credits: red indicator + "Add credits" CTA

### 2.5 Stripe Products Setup
- [ ] Create Stripe products and prices in Stripe dashboard:
  - Product: **Starter** → recurring price $29/mo, metadata `credits_per_period: 600`
  - Product: **Professional** → recurring price $79/mo, metadata `credits_per_period: 2000`
  - Product: **Studio** → recurring price $199/mo, metadata `credits_per_period: 6000, seat_limit: 5`
  - Product: **Extra Credits 500** → one-time $19
  - Product: **Extra Credits 2000** → one-time $59
  - Video prices: one-time prices for each video model/duration combination
- [ ] Store price IDs in environment variables or a `lib/stripePrices.ts` constants file

---

## Phase 3 — Individual Billing

### 3.1 Stripe Checkout Flow
- [ ] `npm install @stripe/stripe-js`
- [ ] Create `services/billingService.ts`:
  - `createCheckoutSession(priceId)` → calls Worker, returns Stripe Checkout URL
  - `createPortalSession()` → calls Worker, returns Stripe Customer Portal URL
  - `purchaseCredits(packId)` → Stripe Checkout for one-time credit purchase
- [ ] Worker endpoints:
  - `POST /billing/checkout` → create Stripe Checkout Session, set `success_url` and `cancel_url`
  - `POST /billing/portal` → create Stripe Customer Portal Session
  - `POST /billing/credits` → create Checkout Session for credit top-up
- [ ] Upgrade modal component:
  - Triggered by: locked mode click, zero credits, CTA buttons
  - Shows tier comparison table
  - "Subscribe" button per tier → redirects to Stripe Checkout
- [ ] Post-checkout: Stripe redirects to `?checkout=success` → poll Supabase until plan updates → dismiss modal

### 3.2 Billing Settings Page
- [ ] Add "Billing" tab to user settings panel (or dedicated `/settings/billing` route)
- [ ] Display:
  - Current plan + renewal date
  - Credits remaining this period + rollover info
  - "Manage subscription" button → Stripe Customer Portal
  - "Add credits" button → credit purchase flow
  - Video charges table (last 30 days): model, duration, amount, date
  - Invoice history (fetched from Stripe via Worker)

### 3.3 Video Pay-Per-Generation Flow
- [ ] Before dispatching a video generation:
  1. Call `POST /api/video/charge` on Worker → receive `client_secret` + `video_charge_id`
  2. Confirm Payment Intent using `stripe.confirmCardPayment(client_secret)` — uses saved payment method
  3. If no saved payment method → open Stripe Payment Element modal
  4. On confirmation success → proceed with video generation
  5. On failure → show error, do not generate
- [ ] Show video price clearly in the video panel before generation button
- [ ] Show "Video charges are billed separately" notice on first video generation

---

## Phase 4 — Team Management (Self-Service)

### 4.1 Organization Creation
- [ ] "Create Team" flow (available to Professional+ users upgrading to Studio):
  - Input: organization name
  - Triggers upgrade to Studio plan if not already on it
  - Creates `organizations` row and `organization_members` row (role: owner)
  - Supabase Edge Function: `create-organization`
- [ ] User can only belong to one organization at a time
- [ ] User can leave an org (if not owner); ownership must be transferred before owner can leave

### 4.2 Team Dashboard — Members Tab
- [ ] Route: `/team` (visible only to org members, redirects others)
- [ ] Members list table:
  - Columns: avatar, name, email, role, last active, credits used this period
  - Role badge (Owner / Admin / Member)
  - Actions (admin/owner only): Change role dropdown, Remove button
- [ ] Invite members:
  - Input email + select role → calls `POST /team/invite` on Worker
  - Worker: inserts `org_invites` row, sends email via Resend with invite link
  - Invite link: `https://app.avas.ai/join?token=<uuid>`
  - Invite acceptance: verify token not expired, create/link user account, add to org
- [ ] Pending invites list: email, role, expires, Resend button, Revoke button
- [ ] Seat usage indicator: `3 / 5 seats used` progress bar
- [ ] Add seats button (owner only): opens Stripe flow to update subscription quantity

### 4.3 Team Dashboard — Credits Tab
- [ ] Shared credit pool balance (large, prominent)
- [ ] Credits allocated this period vs consumed vs remaining
- [ ] Per-member usage breakdown: bar chart or table (name, credits used, % of total)
- [ ] Credit history table: timestamp, member name, mode, credits deducted
- [ ] Purchase extra credits button → Stripe Checkout (one-time, adds to org pool)
- [ ] Rollover notice: shows how many credits will roll over at period end

### 4.4 Team Dashboard — Subscription Tab
- [ ] Current plan details: Studio / Enterprise, renewal date, seats
- [ ] "Manage subscription" → Stripe Customer Portal (org's Stripe customer)
- [ ] Upgrade to Enterprise CTA (contact sales form or Calendly link)
- [ ] Cancel subscription: confirmation dialog, clarifies credits remain until period end

### 4.5 Team Dashboard — Video Charges Tab
- [ ] Table: member, model, duration, amount, date, status
- [ ] Monthly total video spend
- [ ] Filter by member, date range

### 4.6 Credit Deduction Logic for Org Members
- [ ] When a user who belongs to an org generates:
  - Deduct from `organizations.credits`, not `users.credits`
  - Log `usage_log` with both `user_id` and `org_id`
  - If org credits = 0 → generation blocked, notify org admins
- [ ] Bonus credits (signup) are personal and not shared with org pool

### 4.7 Ownership Transfer
- [ ] Owner selects a member to transfer ownership to
- [ ] Confirmation dialog with warning
- [ ] Updates `organization_members` roles atomically
- [ ] Transfers Stripe customer ownership (update billing email)

---

## Phase 5 — Super-Admin Panel

> Accessible only to users with `role = 'superadmin'` in `public.users`.
> Route: `/admin` — redirect to 404 for all non-superadmin users.

### 5.1 Users Directory
- [ ] Paginated, searchable table (search by email, name)
- [ ] Filter: by plan, by suspended status, by signup date range
- [ ] Sort: by created_at, by credits remaining, by last active
- [ ] Columns: avatar, email, name, plan, credits, org (if any), joined, last active, status

### 5.2 User Detail Page (`/admin/users/:id`)
- [ ] Profile card: name, email, avatar, plan, joined date, last active
- [ ] Stripe customer link (opens Stripe dashboard in new tab)
- [ ] Current credits + signup bonus remaining
- [ ] Organization membership (if any): org name, role, link to org page
- [ ] **Actions:**
  - Manual credit adjustment: input amount (positive or negative) + required reason field → writes `credit_adjustments` + updates `users.credits`
  - Force plan change: dropdown of plans → updates `users.plan` + adjusts credits
  - Suspend account: sets `suspended_at = now()` → Worker blocks JWT immediately
  - Unsuspend: clears `suspended_at`
  - Impersonate: generates a scoped short-lived token to log in as this user (for debugging)
- [ ] Usage log table: timestamp, mode, credits used, bonus flag
- [ ] Video charges table: model, duration, amount, date, status

### 5.3 Organizations Directory (`/admin/orgs`)
- [ ] Paginated, searchable table
- [ ] Columns: name, plan, seats used/limit, credits remaining, MRR, created

### 5.4 Organization Detail Page (`/admin/orgs/:id`)
- [ ] Org info card: name, plan, seat limit, credits, created
- [ ] Stripe subscription link
- [ ] Members table: name, email, role, joined, credits consumed this period
- [ ] **Actions:**
  - Manual credit adjustment (org pool)
  - Force seat limit change
  - Force plan change
  - Dissolve org: removes all members from org, migrates them back to individual accounts, cancels org subscription
- [ ] Usage log: all members' generations, filterable by member and date
- [ ] Video charges: all members' video charges

### 5.5 Revenue Dashboard (`/admin/revenue`)
- [ ] MRR by tier (Starter / Professional / Studio) — bar chart
- [ ] New subscriptions this month vs last month
- [ ] Churned subscriptions this month
- [ ] Video revenue this month (sum of succeeded `video_charges`)
- [ ] Credit pack revenue this month
- [ ] Estimated API cost this month (credits deducted × $0.05 × cost factor per mode)
- [ ] Gross margin indicator: (revenue - estimated API cost) / revenue

### 5.6 Usage Analytics (`/admin/analytics`)
- [ ] Generations per day chart (filterable by mode)
- [ ] Most used modes ranking (bar chart)
- [ ] Average credits per session
- [ ] Failed generations log: timestamp, user, mode, error message
- [ ] Active users (DAU / MAU)

---

## Phase 6 — Email Notifications

- [ ] Set up Resend account and domain (e.g. `mail@avas.ai`)
- [ ] Add `RESEND_API_KEY` to Worker secrets
- [ ] Create Supabase Edge Function `send-email` that calls Resend API
- [ ] Implement email templates (HTML + plain text) for:
  - **Welcome**: sent on signup — explains bonus credits and what to try
  - **Team invite**: invite link, org name, invited-by name, expiry date
  - **Invite accepted**: notify org admin that someone joined
  - **Low credits warning**: sent at 20% remaining (both individual and org admins)
  - **Credits exhausted**: sent at 0 credits — include upgrade/top-up CTA
  - **Subscription confirmed**: plan name, credits allocated, renewal date
  - **Subscription cancelled**: credits remaining until period end
  - **Payment failed**: retry link via Stripe Customer Portal
  - **Monthly usage summary**: credits used, top modes, video spend (org admins only)

---

## Phase 7 — Storage: Persistent Generated Outputs

> Currently all generated images/videos live in browser memory and are lost on page reload.

- [ ] Create Supabase Storage bucket `generations` (private, RLS-protected)
- [ ] RLS policy: users can only read/write to `generations/<user_id>/`
- [ ] After every successful generation:
  - Upload result to `generations/<user_id>/<nanoid>.<ext>`
  - Store public URL in `usage_log` row
- [ ] Load past generations from Storage on app load (replace current in-memory history)
- [ ] History panel shows persisted generations across sessions
- [ ] Add "delete generation" option (removes from Storage + usage_log)
- [ ] Storage cleanup: auto-delete generations older than 90 days for Starter, 1 year for Professional+

---

## Phase 8 — Public Landing Page

> Separate from the app. Can be a standalone Next.js site or a simple HTML page at the root domain.

- [ ] Sections:
  - Hero: headline, subheadline, demo video or animated screenshot
  - Feature showcase: one section per mode group with example renders
  - Pricing table: Starter / Professional / Studio with feature comparison
  - Social proof: testimonials from beta users (architecture firms)
  - FAQ: pricing, video charges, team plans, data privacy
  - CTA: "Start free trial" → signup page
- [ ] SEO: meta tags, Open Graph, structured data
- [ ] Analytics: Plausible or Posthog (privacy-friendly)
- [ ] Cookie banner (GDPR)

---

## Phase 9 — Polish & Hardening

### 9.1 Rate Limiting
- [ ] Add rate limiting in Cloudflare Worker: max 10 concurrent generations per user
- [ ] Queue indicator in UI if a generation is already in progress
- [ ] Abuse detection: alert if a user burns > 200 credits in < 1 hour

### 9.2 Error Handling & Resilience
- [ ] Graceful degradation when Gemini API is down: show user-friendly error, refund credits
- [ ] Retry logic for video generation polling (Veo/Kling can take 2-5 minutes)
- [ ] Credit refund on failed generation (Worker rolls back deduction if API call fails)

### 9.3 Data Privacy & Compliance
- [ ] Privacy policy page
- [ ] Terms of service page
- [ ] Data deletion endpoint: user can request full account deletion (purges Supabase + Storage + Stripe customer)
- [ ] GDPR data export: user can download all their data as JSON
- [ ] Do not store uploaded reference images beyond the generation session (headshots especially — GDPR sensitive)

### 9.4 Performance
- [ ] Lazy-load `ImageCanvas.tsx` (94KB Three.js component) for non-3D modes
- [ ] Split Zustand store into smaller slices (current single store has 30+ sub-objects)
- [ ] CDN for generated outputs (Supabase Storage CDN or Cloudflare R2)

---

## Environment Variables Checklist

### Frontend `.env.local`
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_GATEWAY_URL=
VITE_PDF_CONVERTER_API_URL=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_STARTER_PRICE_ID=
VITE_STRIPE_PROFESSIONAL_PRICE_ID=
VITE_STRIPE_STUDIO_PRICE_ID=
VITE_STRIPE_CREDITS_500_PRICE_ID=
VITE_STRIPE_CREDITS_2000_PRICE_ID=
```

### Cloudflare Worker secrets (via `wrangler secret put`)
```
SUPABASE_JWT_SECRET
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
GEMINI_API_KEY
GOOGLE_PROJECT_ID
GOOGLE_SERVICE_ACCOUNT_KEY
KLING_PIAPI_API_KEY
KLING_ULAZAI_API_KEY
KLING_WAVESPEEDAI_API_KEY
CONVERTAPI_SECRET
ILOVEPDF_PUBLIC_KEY
RESEND_API_KEY
```

---

## Dependencies to Install

```bash
# Supabase
npm install @supabase/supabase-js

# Stripe
npm install @stripe/stripe-js

# Email (if calling Resend from frontend for any reason)
npm install resend
```

---

## Key Architectural Rules (do not break these)

1. **Credit checks always happen server-side in the Worker.** The UI can optimistically hide
   buttons, but the Worker is the enforcer. A user bypassing the frontend must still be blocked.

2. **Video payment is always pre-authorized.** The Veo/Kling API call never starts until
   Stripe confirms the payment. Never risk $3.20 in API cost without confirmed payment.

3. **Org members draw from org credits, never personal.** The Worker must resolve which
   credit pool to deduct from based on org membership before every generation.

4. **Supabase RLS is the data layer security.** The service role key (used only in the Worker)
   bypasses RLS for admin operations. The anon key (used in the frontend) is always subject to RLS.

5. **Bonus credits are personal and mode-gated.** They cannot be used for video, document
   translation, material validation, or any Professional+ mode. Enforce in the Worker.

6. **Starter plan has zero credit rollover.** Professional and Studio roll over up to 50%
   of monthly allocation. Enterprise is negotiated case by case.

---

## Progress Tracker

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| 1 — Foundation: DB, Auth, Worker | Not started | — | — |
| 2 — Authentication & Onboarding | Not started | — | — |
| 3 — Individual Billing | Not started | — | — |
| 4 — Team Management | Not started | — | — |
| 5 — Super-Admin Panel | Not started | — | — |
| 6 — Email Notifications | Not started | — | — |
| 7 — Storage: Persistent Outputs | Not started | — | — |
| 8 — Public Landing Page | Not started | — | — |
| 9 — Polish & Hardening | Not started | — | — |
