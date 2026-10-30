# Releasing `@poli-page/nextjs`

The package is published to npm as [`@poli-page/nextjs`](https://www.npmjs.com/package/@poli-page/nextjs) by `.github/workflows/release.yml`, the same way `@poli-page/sdk` is released:

1. Pushing a tag `vX.Y.Z` starts the workflow.
2. The `verify` job checks the tagged commit: the tag equals `version` in `package.json`, `CHANGELOG.md` has a `## [X.Y.Z]` section, and `X.Y.Z` is not on npm yet. It then runs typecheck, lint, the build, the example app build (the contract tests serve it), the full test suite with the pinned API contract (`POLI_CONTRACT`), and `npm pack` (the tarball listing is printed in the log).
3. The `publish` job runs in the `npm-publish` GitHub environment, so it waits for a required reviewer to approve it. It publishes with `npm publish --access public --provenance` through npm Trusted Publishing (OIDC, no token secret), on the `latest` dist-tag, or `next` for a pre-release such as `1.0.0-rc.1`. It then creates the GitHub Release with the version's CHANGELOG section as notes.

Only `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE` and `package.json` are published (`files` in `package.json`); the example app and the tests are not. Check with `npm run build && npm pack --dry-run`.

## One-time setup (before the first release)

The package name `@poli-page/nextjs` was free on npm on 2026-10-30 (`npm view @poli-page/nextjs` answered `404`). The `@poli-page` scope is the one `@poli-page/sdk` is published under.

npm can only attach a trusted publisher to a package that already exists, so the first release needs a placeholder version first.

1. **GitHub environment.** In `poli-page/nextjs` → Settings → Environments → New environment, create `npm-publish`. Under Deployment protection rules, tick Required reviewers and add the maintainer who approves releases. No secrets or variables.
2. **Create the package on npm** with a placeholder (needs `npm login` on an account with publish rights on `@poli-page` and 2FA):

   ```bash
   mkdir /tmp/poli-page-nextjs-bootstrap && cd /tmp/poli-page-nextjs-bootstrap
   npm init -y --scope=@poli-page >/dev/null
   npm pkg set name=@poli-page/nextjs version=0.0.0-bootstrap.0 license=MIT \
     description="Placeholder for the first trusted publish of @poli-page/nextjs" \
     repository.type=git repository.url=git+https://github.com/poli-page/nextjs.git
   npm publish --access public --tag bootstrap
   ```

3. **Trusted publisher.** On npmjs.com → `@poli-page/nextjs` → Settings → Trusted publishing → GitHub Actions, enter: Organization or user `poli-page`, Repository `nextjs`, Workflow filename `release.yml`, Environment name `npm-publish`. Or, with npm >= 11.15:

   ```bash
   npm trust github @poli-page/nextjs --repo poli-page/nextjs --file release.yml --env npm-publish --allow-publish
   ```

   npm expires a new trusted publisher that has not published within 2 days, so do the next step within 2 days.
4. **Release 0.11.0**: follow [Each release](#each-release) from step 3 with `v0.11.0`.
5. **Retire the placeholder** once `0.11.0` is on npm as `latest`:

   ```bash
   npm dist-tag rm @poli-page/nextjs bootstrap
   npm deprecate @poli-page/nextjs@0.0.0-bootstrap.0 "Placeholder, use 0.11.0 or later"
   ```

6. Optional: npmjs.com → package Settings → Publishing access → "Require two-factor authentication and disallow tokens", so only the trusted publisher can publish.

## Each release

1. On a branch off `main`, set `version` in `package.json` (and the root entries of `package-lock.json` and the `..` entry of `example-app/package-lock.json`), move `[Unreleased]` in `CHANGELOG.md` to `## [X.Y.Z] - YYYY-MM-DD` with a fresh empty `## [Unreleased]` above it, and update the compare links at the bottom.
2. Open a PR, wait for CI, merge it.
3. Tag the merge commit on `main` and push the tag:

   ```bash
   git switch main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. Watch the Release run in the Actions tab. When `verify` is green, approve the `npm-publish` deployment.
5. Check the result: `npm view @poli-page/nextjs@X.Y.Z`, the provenance badge on the npm page, and the GitHub Release.

If `verify` fails, nothing was published: fix it on `main`, delete the tag (`git push --delete origin vX.Y.Z && git tag -d vX.Y.Z`) and tag again. A published version can't be republished; release a new patch version instead.
