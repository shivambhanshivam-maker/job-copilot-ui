# Job Co-Pilot

An AI-powered job search and application management platform. Upload your CV, paste a job description, and get a real-time fit score with actionable recommendations — then track every application through to offer.

---

## Features

- **CV-Job Matching** — Stream a live fit score (0–100) with a breakdown of strengths, gaps, and suggested CV adjustments
- **In-Platform CV Editor** — Edit your CV in a rich Markdown editor with focus mode and export to DOCX
- **Application Tracker** — Log and manage every application with status, notes, interview dates, and pending-action alerts
- **Post-Application Analysis** — After applying, unlock interview prep tips, talking points, and skill gap insights
- **Job Listings** — Browse and search integrated job postings
- **Analytics Dashboard** — Visualise application velocity, conversion funnel, pipeline breakdown, and channel ROI
- **AI Chat Assistant** — Floating assistant for real-time job search guidance (streamed responses)
- **CV Library** — Store and switch between multiple CVs; set a default

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Angular 17 (standalone components) |
| Language | TypeScript 5.4 |
| Styling | Tailwind CSS 3.4 + SCSS |
| Rich Text | Tiptap 3 with Markdown extension |
| Document Export | docx + file-saver |
| Data Grid | AG Grid Community 31 |
| Date Picker | Flatpickr 4 |
| HTTP / Streaming | Angular HTTP Client + SSE (`EventSource`) + Fetch API |
| SSR | Angular SSR 17 + Express 4 |
| Testing | Karma + Jasmine |

---

## Prerequisites

- Node.js 18+
- npm 9+
- The Job Co-Pilot backend API running on `http://localhost:8084`

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server (proxies /api/* to localhost:8084)
npm start
```

Open [http://localhost:4200](http://localhost:4200). Sign up or log in to access the main features.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm start` | Start dev server at `localhost:4200` with API proxy |
| `npm run build` | Production build output to `dist/` |
| `npm run watch` | Watch mode (rebuild on file changes) |
| `npm test` | Run unit tests (Karma) |
| `npm run serve:ssr:job-copilot-ui` | Serve the SSR build |

---

## Project Structure

```
src/
├── app/
│   ├── home/              # CV-job matching — the core feature
│   ├── job-applications/  # Application tracker table
│   ├── cv-list/           # CV library and editor
│   ├── job-listings/      # Job catalog browse/search
│   ├── analytics/         # Charts and pipeline metrics
│   ├── chat/              # Streaming AI assistant
│   ├── auth/              # Login, signup, route guards
│   ├── services/          # API, Auth, Toast services
│   ├── sidebar/           # Navigation shell
│   ├── shared/            # Shared directives (Flatpickr)
│   ├── toast/             # Toast notification component
│   ├── app.config.ts      # App-level providers
│   └── app.routes.ts      # Route definitions with auth guard
├── environments/          # Environment configs (dev / prod)
└── styles.scss            # Global styles
```

---

## Authentication

All routes except `/login` and `/signup` are protected by a route guard. The app uses JWT tokens; an HTTP interceptor attaches the token to every API request automatically.

---

## Configuration

| File | Purpose |
|---|---|
| `proxy.conf.json` | Proxies `/api/*` to `http://localhost:8084` in dev |
| `environments/environment.ts` | Sets the API base URL |
| `tailwind.config.js` | Tailwind CSS theme |
| `angular.json` | Build budgets, styles, and asset configuration |

To point the app at a different backend, update `apiUrl` in `environments/environment.ts` and the target in `proxy.conf.json`.
