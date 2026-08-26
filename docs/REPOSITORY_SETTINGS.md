# Repository settings

> **Proposed — not yet applied.** This document records the intended repository configuration. Before making any change, re-verify the live repository state and review the resulting diff. Nothing in this document proves that a setting or ruleset is active.

## Read-only baseline

The following baseline was captured on 2026-08-26 using read-only repository
and code-security queries:

- The default branch is `master`.
- No repository rulesets or branch protection rules exist.
- Merge commits, rebases, and squash merges are all allowed.
- Auto-merge and automatic deletion of merged branches are disabled.
- Discussions is disabled.
- The repository homepage is unset and the topic list is empty.
- Private vulnerability reporting is disabled.
- Dependabot security updates and automated security fixes are disabled.
- CodeQL default setup is `not-configured`.
- Secret scanning and push protection are enabled.

Live state can change independently of this file. Re-capture it immediately
before applying the proposal, and stop if it no longer matches this baseline.

## Proposed repository settings

- Allow squash merges only; disable merge commits and rebase merges.
- Enable auto-merge, always suggest updating pull request branches, and delete
  head branches automatically after merge.
- Enable Discussions.
- Enable private vulnerability reporting, Dependabot alerts, Dependabot
  security updates, and CodeQL default setup.
- Retain secret scanning and push protection.
- Set the homepage to
  `https://www.npmjs.com/package/docusaurus-numbered-headings`.
- Set exactly these topics: `docusaurus`, `docusaurus-plugin`,
  `numbered-headings`, `documentation`, and `mdx`.

GitHub documents these controls under
[branches and merges](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository),
[Dependabot](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/dependabot-quickstart),
[private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting),
and [CodeQL default setup](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configure-code-scanning).

## Proposed `master` branch ruleset

Create one active branch ruleset with these exact properties:

- Target: `refs/heads/master`.
- Bypass actors: none.
- Block branch deletion and force pushes.
- Require linear history.
- Require changes to enter through a pull request.
- Require all review threads to be resolved before merge.
- Require the exact status check `quality`.
- Required approvals: `0`, matching the single-maintainer workflow while still
  enforcing the pull request, checks, and resolved-thread requirements.

## Proposed release-tag ruleset

Create one active tag ruleset with these exact properties:

- Target: `refs/tags/v*`.
- Bypass actors: none.
- Block deletion and non-fast-forward updates.
- Allow normal creation of new matching tags.

See GitHub's documentation for
[creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
and the [available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
before applying either proposal.

## Proposed protected publishing prerequisites

These publishing prerequisites are also proposals, not statements of live configuration. The captured GitHub baseline has no Actions environments, and the npm trusted-publisher state has not been authenticated and verified. Do not run the Release workflow until both prerequisites have been applied and independently re-read from their respective services.

1. Create a GitHub Actions environment named exactly `npm-publish`.
   - Add at least one required reviewer who is authorized to approve a public package release.
   - Enable **Prevent self-review** and ensure at least one required reviewer is independent of the person who starts the deployment.
   - Configure the environment to prevent administrators from bypassing its protection rules.
   - Configure its deployment branch and tag policy to allow only protected tags matching `v*`.
   - Do not add an npm token, environment secret, or repository secret for publication. The publish job receives only the GitHub OIDC identity permission.
2. Configure the npm trusted publisher for the public `docusaurus-numbered-headings` package with exactly these values:

   | npm trusted-publisher field | Required value                 |
   | --------------------------- | ------------------------------ |
   | npm user or organization    | `t4dhg`                        |
   | Repository                  | `docusaurus-numbered-headings` |
   | Workflow filename           | `release.yml`                  |
   | Environment                 | `npm-publish`                  |
   | Allowed action              | `npm publish`                  |

After configuration, re-read the environment protections and trusted-publisher record. Confirm that the case-sensitive owner, repository, workflow filename, and environment exactly match the table before pushing any release tag.

## Proposed post-publication token retirement

Only after the first successful OIDC publication has been verified against the exact prepared tarball and its SLSA provenance:

1. Disallow traditional npm automation tokens for this package where the npm controls permit it.
2. Revoke obsolete automation tokens that were previously capable of publishing this package.

If the OIDC publication or its registry verification fails, do not retire credentials as though the migration succeeded. Investigate the failure without creating a replacement tag or adding a token to the trusted-publishing workflow.

## Application checklist

1. Re-capture the live baseline, including existing runs and exact check names.
2. Compare each proposed setting with the current GitHub UI or API response.
3. Apply repository settings and security features deliberately, one group at a
   time.
4. Create the branch and tag rulesets with no bypass actors.
5. Apply and re-read the protected publishing prerequisites above without adding a long-lived npm publishing credential.
6. Open a pull request and confirm that the exact `quality` check is produced
   and required before treating the branch ruleset as usable.
7. Record the applied state separately; do not edit the status above merely
   because the proposal was reviewed.
