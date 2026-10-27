# Auth System — SkyGen

## Overview

Authentication is built on **NextAuth v5** with Google as the sole provider. There is no username/password login. The system uses a **JWT session strategy** — no server-side session store, the session lives in an encrypted cookie on the client.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Auth framework | NextAuth v5 (`next-auth`) |
| Provider | Google OAuth 2.0 |
| Session storage | Encrypted JWT cookie (`__Secure-next-auth.session-token`) |
| User storage | PostgreSQL (`users` table) |
| Ban list | PostgreSQL (`banned_emails` table) |

---

## Sign-In Flow

```
Browser → clicks "Sign in with Google"
        ↓
NextAuth redirects to accounts.google.com
        ↓
User approves → Google sends auth code back to /api/auth/callback/google
        ↓
signIn() callback fires
  → syncUser() called
  → checks banned_emails → if found, returns false (blocks login)
  → checks deleted_at IS NOT NULL → if found, returns false (blocks login)
  → upserts user row (INSERT ... ON CONFLICT (email) DO UPDATE)
        ↓
jwt() callback fires
  → stores token.sub = Google provider account ID
        ↓
Encrypted JWT written to httpOnly cookie on app domain
        ↓
User lands on homepage (TemplateGallery)
```

---

## Session Refresh Flow

Every time `useSession()` makes a server call, the `session()` callback fires:

```
Request arrives with JWT cookie
        ↓
session() callback in auth.ts
  → syncUser() called (reads fresh data from DB every time)
  → if blocked → returns null (invalidates session immediately)
  → sets session.user.id, role, videoCount, videoLimit from DB row
        ↓
session object returned to client
```

> This means **role and usage changes in the DB are reflected on the next session refresh** — no re-deploy needed. However, `useSession()` caches the result in React memory for a few seconds.

---

## Sign-Out Flow

Logout hits `/api/auth/logout` (GET):

```
Browser → GET /api/auth/logout
        ↓
signOut({ redirect: false })
  → clears NextAuth JWT cookie on app domain
        ↓
Redirect to accounts.google.com/logout
  → clears Google's session cookie on google.com domain
        ↓
Google redirects back to app homepage
```

**Why redirect to Google?** Without it, Google auto-re-authenticates the user silently on next sign-in (no account picker shown). Clearing the Google cookie forces the account picker to appear.

---

## User Identity & Cross-Device

Users are identified by **email** as the canonical key, not Google's account ID:

```sql
INSERT INTO users (id, email, name, role, ...)
VALUES ($1, $2, $3, 'USER', ...)
ON CONFLICT (email) DO UPDATE
  SET id   = EXCLUDED.id,
      name = COALESCE(EXCLUDED.name, users.name)
WHERE users.deleted_at IS NULL
```

- Same email on a new device → reuses existing account row
- `id` column is updated to the latest Google provider account ID
- Role, limits, usage are all preserved

---

## User Deletion & Banning

Deleting a user is a **two-step soft-delete**:

```sql
-- Step 1: soft-delete the user row
UPDATE users SET deleted_at = NOW() WHERE id = $1

-- Step 2: permanently ban their email
INSERT INTO banned_emails (email, reason)
VALUES ($1, $2)
ON CONFLICT (email) DO NOTHING
```

On every sign-in and session refresh, `syncUser()` checks both:
1. `banned_emails` table → blocks permanently even if user row is later hard-deleted
2. `users.deleted_at IS NOT NULL` → blocks if soft-deleted

This means a deleted user **cannot re-register** even from a different device, because the `ON CONFLICT (email) DO UPDATE ... WHERE deleted_at IS NULL` clause skips the upsert for deleted rows, and the ban check fires first anyway.

---

## Roles

Defined in `src/lib/roles.ts`:

| Role | Access |
|---|---|
| `USER` | Standard access, subject to video/AI limits |
| `CONTENT_MANAGER` | Admin panels for content (story arcs, visual styles) |
| `ADMIN` | Full access including user management, no limits |

Role helper functions:
```ts
isAdmin(role)          // role === 'ADMIN'
isContentManager(role) // role === 'ADMIN' || role === 'CONTENT_MANAGER'
hasPremiumAccess(role) // role === 'ADMIN'
```

Roles are stored in the `users` table and can be changed via the admin users panel. Changes reflect in the session on the **next session refresh** (next page load or `useSession().update()` call).

---

## Protecting API Routes

All protected routes use `requireAuthenticatedSession()` from `src/lib/api-security.ts`:

```ts
// Require any logged-in user
const authResult = await requireAuthenticatedSession()
if ('response' in authResult) return authResult.response  // 401

// Require admin
const authResult = await requireAuthenticatedSession({ admin: true })
if ('response' in authResult) return authResult.response  // 401 or 403

// Require content manager or above
const authResult = await requireAuthenticatedSession({ contentManager: true })
if ('response' in authResult) return authResult.response  // 401 or 403

// Access session
const { session } = authResult
session.user.id    // user id
session.user.role  // 'ADMIN' | 'CONTENT_MANAGER' | 'USER'
```

---

## Session Type

Defined in `src/lib/auth.ts`:

```ts
interface Session {
  user: {
    id: string           // canonical DB id (Google provider account ID)
    name?: string | null
    email?: string | null
    image?: string | null
    role: "ADMIN" | "USER"
    videoCount: number
    videoLimit: number
  }
}
```

---

## Cookie Storage Summary

```
google.com domain
└── SSID, SID, HSID ...
    "Is this browser logged into Google?"
    Only google.com can read/write — your app has no access

yourapp.com domain
└── __Secure-next-auth.session-token
    Encrypted JWT: { sub: "google_provider_account_id" }
    httpOnly (JS cannot read), Secure, SameSite=Lax
    Expires: ~30 days
    Cleared on logout
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | NextAuth config, callbacks (signIn, jwt, session) |
| `src/lib/user-sync.ts` | DB upsert, ban/delete checks, returns user row |
| `src/lib/roles.ts` | Role types and helper functions |
| `src/lib/api-security.ts` | `requireAuthenticatedSession()` for API route protection |
| `src/app/api/auth/logout/route.ts` | Custom logout — clears NextAuth cookie + Google session |
| `src/app/api/db/init/route.ts` | Runs DB migrations (requires admin or `DB_INIT_SECRET`) |
| `src/lib/db-migrate.ts` | Migration definitions including `banned_emails`, `deleted_at` |

---

## First-Time Setup (New Environment)

If the DB has no admin user yet, you can't access `/api/db/init` normally. Use the secret key:

1. Set `DB_INIT_SECRET=<your-secret>` in environment variables
2. Hit: `GET /api/db/init?secret=<your-secret>`
3. This creates all tables, seeds the admin user, and runs all migrations
4. Sign in with Google — `syncUser()` will find the seeded admin row and assign the ADMIN role
