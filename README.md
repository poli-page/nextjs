# @poli-page/nextjs

Next.js integration for [Poli Page](https://poli.page) — generate PDFs from Server Actions, Route Handlers, and the App Router with Next.js-native ergonomics.

> **Status**: scaffold only. Implementation begins in P0.2 of the [SDK roadmap](https://github.com/poli-page/poli-page/blob/develop/docs/onboarding/micka/sdk-roadmap.md).

## Install

```bash
npm install @poli-page/nextjs @poli-page/sdk
```

## Quick start

To be filled in as the integration is built. The package will expose helpers for Route Handlers (`app/api/<route>/route.ts`), Server Actions, and Edge runtime where supported.

## Dependencies

This package wraps [`@poli-page/sdk`](https://github.com/poli-page/sdk-node) and lists it as a peer/runtime dependency. All HTTP, retry, and error-handling logic lives in the core SDK — this repo only adds Next.js-specific glue.

## Publishing

Published to **npm** as [`@poli-page/nextjs`](https://www.npmjs.com/package/@poli-page/nextjs).

## Documentation

Full Poli Page documentation is at [docs.poli.page](https://docs.poli.page).

## License

MIT — see [LICENSE](./LICENSE).
