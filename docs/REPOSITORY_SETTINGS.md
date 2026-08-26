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

## Application checklist

1. Re-capture the live baseline, including existing runs and exact check names.
2. Compare each proposed setting with the current GitHub UI or API response.
3. Apply repository settings and security features deliberately, one group at a
   time.
4. Create the branch and tag rulesets with no bypass actors.
5. Open a pull request and confirm that the exact `quality` check is produced
   and required before treating the branch ruleset as usable.
6. Record the applied state separately; do not edit the status above merely
   because the proposal was reviewed.
