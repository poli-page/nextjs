# Releasing `@poli-page/nextjs`

The package is published to npm as [`@poli-page/nextjs`](https://www.npmjs.com/package/@poli-page/nextjs) by `.github/workflows/release.yml`, the same way `@poli-page/sdk` is released.

## Versions

`@poli-page/nextjs` shares its major.minor with the Poli Page API: package `0.13.x` talks to API `0.13`, passes the [API contract](https://github.com/poli-page/api-contract) `v0.13.0`, and requires `@poli-page/sdk` of the same minor (`^0.13.0`, which npm reads as `>=0.13.0 <0.14.0`). Patch numbers are free: a fix to the package alone is a patch, whatever the API's or the SDK's patch. A change of the API contract, a new feature, and a raise of the minimum Node.js or Next.js version are each a minor. The package may skip minors when it has nothing to ship for one. The Release workflow refuses a tag whose major.minor differs from the contract version pinned in `.github/workflows/ci.yml` (the pin in `release.yml` must be the same commit) or from the `@poli-page/sdk` requirement in `package.json` and `example-app/package.json`.

## How a release runs

1. Pushing a tag `vX.Y.Z` starts the workflow.
2. The `verify` job checks the tagged commit: the tag equals `version` in `package.json`, `CHANGELOG.md` has a `## [X.Y.Z]` section, the tag is a valid version, and `scripts/check-release-versions.sh` passes: the pinned API contract commit must carry a stable tag `vX.Y.Z` of the tag's major.minor (the `# vX.Y.Z` comment next to the pin is not trusted), `release.yml` must pin the same commit as `ci.yml`, and `@poli-page/sdk` must be required as `^X.Y` of the tag's major.minor; the error names both versions. It then runs typecheck, lint, the build, `npm run lint:pack` (attw + publint), the example app build (the contract tests serve it), the full test suite with the pinned API contract (`POLI_CONTRACT`), and `npm pack` (the tarball listing is printed in the log).
3. The `publish` job runs in the `npm-publish` GitHub environment, so it waits for a required reviewer to approve it. It installs dependencies without their install scripts, then publishes with `npm publish --access public --provenance` through npm Trusted Publishing (OIDC, no token secret), on the `latest` dist-tag, or `next` for a pre-release such as `1.0.0-rc.1`. It then creates the GitHub Release with the version's CHANGELOG section as notes.

Only `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE` and `package.json` are published (`files` in `package.json`); the example app and the tests are not. Check with `npm run build && npm pack --dry-run`.

## One-time setup (before the first release)

The package name `@poli-page/nextjs` was free on npm on 2026-10-30 (`npm view @poli-page/nextjs` answered `404`). The `@poli-page` scope is the one `@poli-page/sdk` is published under.

npm can only attach a trusted publisher to a package that already exists, so the first release needs a placeholder version first. Do steps 2 to 5 in one sitting, after the release PR is merged: until `0.13.0` lands, the placeholder is the package's `latest` (`npm install @poli-page/nextjs` would get an empty package), and npm expires a new trusted publisher that has not published within 2 days.

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

4. **Release 0.13.0**: follow [Each release](#each-release) from step 3 with `v0.13.0`.
5. **Remove the placeholder** once `0.13.0` is on npm as `latest`. npm lets you unpublish a version within 72 hours of publishing it:

   ```bash
   npm unpublish @poli-page/nextjs@0.0.0-bootstrap.0
   ```

   After 72 hours, deprecate it instead:

   ```bash
   npm dist-tag rm @poli-page/nextjs bootstrap
   npm deprecate @poli-page/nextjs@0.0.0-bootstrap.0 "Placeholder, use 0.13.0 or later"
   ```

6. Optional: npmjs.com → package Settings → Publishing access → "Require two-factor authentication and disallow tokens", so only the trusted publisher can publish.

## Each release

1. On a branch off `main`, set `version` in `package.json` (and the root entries of `package-lock.json` and the `..` entry of `example-app/package-lock.json`), move `[Unreleased]` in `CHANGELOG.md` to `## [X.Y.Z] - YYYY-MM-DD` with a fresh empty `## [Unreleased]` above it, and update the compare links at the bottom. Set the two `v…` labels in `example-app/app/page.tsx` to the version, and update the compatibility table in `README.md` when the minor or the supported Next.js/Node versions change.

   For a new minor `X.Y`: require `@poli-page/sdk` `^X.Y.0` in `package.json` and `example-app/package.json` (and their lock files, and the requirement named in `README.md` and `example-app/README.md`), pin the API contract's `vX.Y.0` commit in `.github/workflows/ci.yml` and `.github/workflows/release.yml`, and check them with `./scripts/check-release-versions.sh X.Y.0` (it needs network access to list the contract's tags).
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

If `publish` fails after npm accepted the package (for example while creating the GitHub Release), re-run the failed jobs: a version already on npm is not published again, and the GitHub Release is created only if it is missing. Both jobs first check that the version on npm was published from the tagged commit (npm's `gitHead` for it equals the tag's commit) and fail if it was not, so a tag moved to another commit can't release notes and a GitHub Release for code that is not on npm.
