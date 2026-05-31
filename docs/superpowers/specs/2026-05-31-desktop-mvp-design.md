# Desktop MVP Design

Date: 2026-05-31
Status: Approved design draft
Scope: Split current work into paused WEB track and new Electron desktop MVP track.

## Context

The current repository is progressing as a web-first product with `frontend/` (Next.js) and `backend/` (Spring Boot). The web plan has grown into a broad V1 scope: authentication, project and character CRUD, editor autosave, manuscript mode, memo capture, mobile tokens, PWA, and deployment.

The project should now shift to a faster feedback loop:

- Keep the existing WEB work in the repository but mark it as blocked/paused.
- Add a new `desktop/` app for a focused desktop MVP.
- Do not port the existing web UI design. The desktop app gets a fresh design direction.
- Build only the product core needed to validate daily writing usage.

## Decisions

### Product Track Split

Use the current repository as a multi-track workspace:

```text
frontend/        # Existing WEB frontend. Development paused.
backend/         # Existing WEB backend. Not used by desktop MVP initially.
desktop/         # New Electron desktop app.
docs/            # Planning/status documents.
specs/           # Existing Spec Kit specs and future desktop specs.
```

This avoids a large path migration. The existing `frontend/` and `backend/` remain intact, while `desktop/` can move quickly without inheriting current web constraints.

### Storage Strategy

Use local-first persistence with a future sync path.

The desktop MVP should store projects, documents, and memos locally, most likely in SQLite. It should not depend on login, OAuth, Spring Boot, Vercel, Render, or mobile capture tokens for the first usable version.

Data modeling should still avoid desktop-only shortcuts that would make later web/sync migration painful. Local records should use stable IDs, explicit timestamps, and clear ownership boundaries even though the first version is single-user.

### Technology Direction

Recommended stack:

- Electron
- Vite
- React
- TypeScript
- TipTap for rich text editing
- SQLite for local storage

Electron is preferred over Tauri for this phase because speed and familiarity matter more than binary size. Wrapping the existing Next.js app is not preferred because it would carry over web routing, design debt, and backend coupling.

### Design Direction

Use the approved **Focus Studio** direction.

The first screen should feel like a quiet desktop writing environment, not a dashboard. The editor is the center of gravity. Project context and memos should be available in a slim side panel or secondary surface, but they should not dominate the writing canvas.

Design implications:

- Large central writing area.
- Minimal persistent chrome.
- Project selector and capture affordances stay accessible but quiet.
- Memo/project context appears beside the editor when useful.
- Avoid the current web visual language.
- Avoid heavy dashboards, decorative cards, and overly saturated palettes.

## MVP Scope

### Included

The first desktop MVP includes:

1. Project creation and selection.
2. Project metadata in a minimal form.
3. One primary document per project.
4. General editor mode.
5. Local autosave.
6. Quick memo capture.
7. Memo inbox.
8. Linking a memo to one project.
9. Viewing linked project memos from the writing screen.

### Deferred

The first desktop MVP explicitly excludes:

- Manuscript mode.
- Mobile capture.
- Authentication.
- Server sync.
- Kakao OAuth.
- Email flows.
- PWA.
- Deployment.
- Tags.
- Reason notes.
- Character management.
- Memo pinning inside document text.
- Session notes.
- Search.
- Export.
- AI features.

Manuscript mode remains a core product feature, but it moves to desktop phase 2 so the first MVP can become usable faster.

## Screens

### Projects

Purpose: choose or create the current writing project.

Minimum behavior:

- Show project list.
- Create a project with title and optional short metadata.
- Open a project into the writing studio.

### Write Studio

Purpose: write the current project document.

Minimum behavior:

- Show project title.
- Show central editor.
- Autosave changes locally.
- Restore content after app restart.
- Show basic save state.
- Show linked project memos in a slim side panel.

### Memo Inbox

Purpose: collect captured notes and attach useful ones to projects.

Minimum behavior:

- Show all memos by recent-first order.
- Create a memo manually.
- Link or unlink a memo to a project.
- Filter between all memos and unlinked memos if simple to include.

### Quick Capture

Purpose: capture a thought with minimal friction.

Minimum behavior:

- Open from app UI.
- Later phase can add global shortcut support.
- Save memo body only.
- Default memo is unlinked unless a project is active.

## Data Model

Initial local model:

```text
Project
  id
  title
  summary
  tone
  targetLength
  createdAt
  updatedAt

Document
  id
  projectId
  title
  bodyJson
  plainText
  wordCount
  createdAt
  updatedAt

Memo
  id
  body
  capturedAt
  source
  linkedProjectId nullable
  createdAt
  updatedAt

AppSetting
  key
  value
```

Notes:

- `Document.bodyJson` stores TipTap/ProseMirror JSON.
- `Document.plainText` supports future search and sync conflict previews.
- `Memo.linkedProjectId` is intentionally simple for MVP. Multi-project memo links can be introduced later with a join table.
- IDs should be generated in a sync-friendly format rather than relying only on local autoincrement IDs.

## Success Criteria

The first desktop MVP is successful when:

1. A user can create a project.
2. A user can open the project and write in a normal editor.
3. Written content autosaves locally.
4. Closing and reopening the app restores the content.
5. A user can quickly capture a memo.
6. A user can link a memo to a project.
7. The writing screen shows memos linked to the current project.
8. The app is usable for one real writing session without relying on the web backend.

## Implementation Notes

Keep the first implementation conservative:

- Prefer a small `desktop/` app over moving `frontend/` into `apps/web`.
- Reuse existing logic only when it is clearly portable and does not pull in web assumptions.
- Treat current web UI components as reference material, not as design source of truth.
- Keep the data access boundary explicit so future sync can replace or extend local persistence.
- Do not implement manuscript mode in the first MVP even though it is a core product feature.

## Open Follow-Ups

These should be resolved during implementation planning:

1. Exact local DB library choice for Electron.
2. Whether the first quick capture uses only an in-app modal or also a global shortcut.
3. Whether `Project.summary`, `tone`, and `targetLength` are all shown in the first UI or only stored for later.
4. Whether desktop phase 2 starts with manuscript mode or with richer memo curation.
