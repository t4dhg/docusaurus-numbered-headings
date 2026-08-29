# Repository settings

> **Applied baseline — verified 2026-08-29.**

This document records the public repository controls that were applied and read back from GitHub and npm. It is an audit aid, not an authorization to tag or publish another release. Live state can drift, so re-read the services before each release.

## Applied repository settings

- Squash merges are the only merge method; merge commits and rebase merges are disabled.
- Auto-merge and update-branch suggestions are enabled, and merged head branches are deleted automatically.
- GitHub Discussions is enabled.
- The homepage is `https://www.npmjs.com/package/docusaurus-numbered-headings`.
- The exact topics are `documentation`, `docusaurus`, `docusaurus-plugin`, `mdx`, and `numbered-headings`.

## Applied security and Actions controls

- Secret scanning, push protection, private vulnerability reporting, Dependabot alerts, Dependabot security updates, and automated security fixes are enabled.
- CodeQL default setup is configured for JavaScript and TypeScript with the default query suite and the `remote_and_local` threat model.
- GitHub-owned actions only are permitted; verified Marketplace and custom action patterns are not allowed.
- SHA pinning is required, and every checked-in `uses:` reference uses a reviewed full-length commit SHA.
- Default workflow token permissions are read-only and workflows cannot approve pull requests.

## Applied `master` branch ruleset

Master ruleset ID: `21795261`.

- Target: `refs/heads/master`.
- Bypass actors: none.
- Branch deletion and force pushes are blocked.
- Linear history and pull requests are required.
- Review threads must be resolved before merge.
- The exact required status check is `quality`, with the branch required to be current.
- Required approvals: `0`, matching the single-maintainer workflow while retaining the pull-request, status-check, and conversation-resolution gates.

## Applied release-tag ruleset

Release-tag ruleset ID: `21795263`.

- Target: `refs/tags/v*`.
- Bypass actors: none.
- Deletion and non-fast-forward updates are blocked.
- Normal creation of a new matching tag is allowed by the separately authorized release procedure.

## Applied protected publishing prerequisites

GitHub Actions environment ID: `20829939364`.

1. The GitHub Actions environment named exactly `npm-publish` has a five-minute wait timer.
   - No required reviewer is configured because there is currently no independent release maintainer.
   - Its custom deployment policy permits only tags matching `v*`.
   - Administrators can bypass the environment; for this solo-maintainer repository, the compensating controls are the wait timer, immutable protected tags, pre-publication verification, and exact post-publication registry/provenance checks.
   - The environment contains no npm token, environment publishing secret, or repository publishing secret. The publish job receives only GitHub OIDC identity permission.
2. The npm trusted publisher was configured and re-read on 2026-08-29 with these exact values:

   | npm trusted-publisher field | Required value                 |
   | --------------------------- | ------------------------------ |
   | npm user or organization    | `t4dhg`                        |
   | Repository                  | `docusaurus-numbered-headings` |
   | Workflow filename           | `release.yml`                  |
   | Environment                 | `npm-publish`                  |
   | Allowed action              | `npm publish`                  |

## Proposed post-publication token retirement

Only after the first successful OIDC publication has been verified against the exact prepared tarball and its SLSA provenance:

1. Disallow traditional npm automation tokens for this package where the npm controls permit it.
2. Revoke obsolete automation tokens that were previously capable of publishing this package.

If the OIDC publication or its registry verification fails, do not retire credentials as though the migration succeeded. Investigate the failure without creating a replacement tag or adding a token to the trusted-publishing workflow.

## Release-use checklist

1. Re-capture the live repository, environment, trusted-publisher, and npm version state.
2. Finalize the version and changelog through a pull request that passes the required `quality` check.
3. Create the exact reviewed annotated tag without moving any existing tag.
4. Observe the entire Release workflow, including the environment delay.
5. Treat the release as complete only after the exact registry bytes, signatures, provenance, dist-tag, and stable GitHub Release are verified.
