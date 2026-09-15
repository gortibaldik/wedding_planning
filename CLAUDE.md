# CLAUDE.md

Guidance for working in this repo (FastAPI backend + Vite/Vue 3 frontend for a wedding-planning app).

## Authentication & permissions

Auth is JWT-based and roles live **inside the token**. There is no per-request database
lookup of permissions — whatever roles were baked into the JWT at login time are what the
user has until the token expires.

### Where roles come from

`backend/routers/authorization.py::_create_token_and_redirect` is the single place that
assigns roles. It works off allowlists in `backend/config.py`:

- `allowed_users` — anyone not on this list is bounced back to the landing page, no token.
- `super_users` → `change-genealogy-tree-rw-status`, `universal-invitation-list-setter`,
  `managed-files-editor`
- `managed_files_dump_users` → `managed-files-dump`
- `finance_tracking` → `finance-access`
- `documents_viewers` → `documents-viewer` — required to see the Wedding Organization tab
  at all; defaults to `documents_editors` when unset, and editors always get it too
- `documents_editors` → `documents-editor` — write access on top of viewing

The roles are put in the `roles` claim of the JWT (alongside `sub` = email and `name`),
which is handed to the frontend as `?token=...` on the redirect to `/app`.

Role name constants are **defined in the router that enforces them** and imported by
`authorization.py` (e.g. `FINANCE_ACCESS_ROLE` lives in `routers/finance.py`). Keep it that
way: when adding a role, define the constant next to its enforcement and import it into
`authorization.py`, don't hardcode the string.

### How roles are enforced

`backend/dependencies.py::get_current_user` decodes/validates the JWT and returns its
payload as a dict; a bad or missing token is a 401.

Two enforcement patterns are in use:

1. **Whole router gated by a role** — the router declares a dependency that both resolves
   the user and checks the role. This is what the finance tab does, so *every* `/finance/*`
   endpoint requires `finance-access`:

   ```python
   # backend/routers/finance.py
   FINANCE_ACCESS_ROLE = "finance-access"

   def _require_finance_access(user: Annotated[dict, Depends(get_current_user)]) -> dict:
       if FINANCE_ACCESS_ROLE not in (user.get("roles") or []):
           raise HTTPException(status_code=403, detail="Insufficient permissions")
       return user

   router = APIRouter(prefix="/finance", dependencies=[Depends(_require_finance_access)])
   ```

2. **Router requires login, individual endpoints require a role** — the router declares
   `dependencies=[Depends(get_current_user)]` (login required for the whole tab) and the
   privileged endpoints additionally check a role. Used by `managed_files.py`
   (`_require_editor`, `_require_dump_role`), `family_structure.py` (`CHANGE_STATUS_ROLE`
   for `/change-status`) and `invitation_lists.py` (`_is_universal_list_setter`).

Rule of thumb: if a whole tab is privileged, gate it at the router (pattern 1); if only
some writes are privileged, gate at the endpoint (pattern 2). Always 403 on a missing role,
401 only for a bad token (that's `get_current_user`'s job).

### Frontend side

`frontend/src/composables/useAuth.ts` owns the token: it picks it up from the URL, stores
it in `localStorage`, decodes the payload to `storedUserInfo` (`sub`, `name`, `roles`), and
exposes `authFetch`, which attaches the `Authorization: Bearer` header and clears the token
on a 401. All backend calls should go through `authFetch`, never bare `fetch`.

Role checks in the UI (e.g. `canAccessFinance` in `components/AuthenticatedApp.vue`, which
decides whether the Home Finances tab is even listed) are **cosmetic only** — they hide
tabs the user can't use. The backend check is the real one; never rely on the frontend
gate for security.

## Frontend structure

There are two distinct kinds of pages, and they are built completely differently.

### 1. Static pages (server-rendered)

The landing page (`/`) and `/games` are Jinja2 templates in
`backend/routers/index/templates/` rendered by `backend/routers/index/index.py`. They are
plain HTML with inline `<script>`/`<style>`, no Vue, no bundler. The landing page is
localised server-side: `pick_lang()` maps the request's GeoIP country to a language and the
template is filled from the i18n dict cached in `dependencies.py`.

Their shared styling comes from `frontend/src/landing.scss`, which a small Vite plugin
compiles to `frontend/public/landing.css` (see `frontend/vite.config.js`). Edit the
`.scss`, never the generated `.css`.

`index.py`'s catch-all `/{path:path}` serves `frontend/public/` then `frontend/dist/`,
falling back to the SPA's `index.html`.

### 2. The Vue SPA (`/app`)

`frontend/index.html` → `src/main.js` → `src/App.vue` (auth gate) → `AuthenticatedApp.vue`
(tab shell, hash-routed). Each tab is a component tree under `src/components/`.

**Split logic out of components.** Business logic, state, and backend I/O belong in
composables under `src/composables/`; `.vue` files should contain only what's needed to
display and drive the UI (template, local UI state like "is this menu open", formatting for
display, event wiring).

- **Composables (`src/composables/*.ts`)**: fetching and persisting data, parsing/shaping
  API responses, derived/aggregated values, domain types mirroring the backend Pydantic
  models, sub-tab and pagination state. Written in TypeScript, exporting a `useXxx()`
  function; shared state is declared at module scope (outside `useXxx`) so all consumers
  see the same refs — see `useAuth.ts`, `useFinance.ts`.
- **Components (`src/components/**/*.vue`)**: `<script setup>` that calls the composables
  and holds display-only concerns, plus the template and styles. `FinanceComponent.vue` is
  the model to copy: it pulls `useFinance()` / `useFinanceSubTabs()` and only keeps tab
  labels, lifecycle listeners and markup.

When adding a feature, ask "would this still be true if the UI looked completely
different?" — if yes, it goes in a composable.

Other conventions:
- Import composable members under their original names; don't rename with `:` destructuring
  aliases.
- Use the `@/` alias for `src/`.
- Shared per-feature CSS lives beside the components (e.g. `Finance/finance.css`, pulled in
  with `<style src="...">` and BEM-ish namespaced classes); component-specific styles are
  `<style scoped>`.
- Frontend tooling: `npm run lint`, `npm run format`, `npm run type-check`, `npm test`
  (vitest) from `frontend/`.

### Adding a new backend router

`frontend/vite.config.js` proxies to the backend by an **explicit allowlist of path
prefixes** — there is no catch-all. A new router's prefix must be added there, or in dev
the Vite server answers its requests with the SPA's `index.html` and the composable fails
with `Unexpected token '<', "<!doctype "... is not valid JSON`. Production is unaffected:
`index.py`'s SPA catch-all is registered last in `main.py`, so it only sees paths no router
claimed — which is also why every `app.include_router(...)` must come *before*
`app.include_router(index.router)`.
