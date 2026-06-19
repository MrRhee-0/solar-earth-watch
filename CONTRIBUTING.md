# Contributing

Thanks for helping improve Solar Earth Watch.

## Local Setup

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## TCT-Native Contribution Rules

- Treat the dashboard as a downstream representation surface.
- Treat NOAA, NASA/CCMC, and Helioviewer records as witness surfaces.
- Do not claim packet closure from missing, fixture-backed, or source-failed data.
- Preserve failure classifications instead of replacing them with vague missing-data language.
- Keep new packet logic covered by focused tests.

## Scope

Small, source-backed improvements are preferred. Changes that add new APIs, new witness surfaces, or new alignment rules should update the README and NOTICE when relevant.
