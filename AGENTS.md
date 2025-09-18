# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the Vite + React front end; run all commands from here.
- `app/src/` contains code: `App.tsx` orchestrates the UI and flow graph, `simulation.ts` runs the thermal solver, `types/` holds Plotly type patches, and `assets/` stores static SVGs.
- `app/public/` serves static HTML shell and icons; `app/dist/` is generated output-never edit by hand.
- `app/inspire.json` defines default component presets and should remain synced with UI expectations.

## Build, Test, and Development Commands
- `npm install` (inside `app/`) restores dependencies; re-run after dependency updates.
- `npm run dev` starts the Vite dev server at http://localhost:5173 with hot reload.
- `npm run build` performs a TypeScript project build then bundles production assets into `dist/`.
- `npm run preview` serves the build output locally for smoke checks.
- `npm run lint` runs ESLint using `eslint.config.js`; fix reported issues before committing.

## Coding Style & Naming Conventions
Use TypeScript with React and keep indentation at two spaces (follow existing files). Name React components and hooks in PascalCase, state setters in camelCase, and utility modules in kebab-case file names. Prefer typed props and state over `any`, and centralize constants near their components. ESLint enforces React hooks rules and import hygiene-run the lint script before pushing.

## Testing Guidelines
No automated tests ship today; prioritize adding Vitest or React Testing Library when extending the solver. For now, mirror manual regression steps: validate node editing, simulate typical presets from `inspire.json`, and confirm Plotly charts update after each run. When authoring new tests, place them alongside sources as `*.test.ts(x)` and ensure they cover error paths (for example invalid network topology or non-converging runs).

## Commit & Pull Request Guidelines
The repo lacks historical commits, so default to Conventional Commits (`feat:`, `fix:`, `refactor:`). Keep subject lines <=72 characters and describe user-facing impact in the body. Pull requests should include purpose summary, highlighted UI or API changes, manual test notes, and linked issue or spec references. Attach screenshots or GIFs when altering node editors or chart rendering.

## Configuration Notes
Update `inspire.json` and related UI copy in the same change; any schema tweaks must be reflected in form validation. Vite environment variables belong in `.env.local` files; never commit secrets.
