# Deployment Setup Guide

This guide explains how to set up automated deployment to npm for the `docusaurus-numbered-headings` package.

## Prerequisites

1. **GitHub Repository**: Your code should be in a GitHub repository
2. **npm Account**: You need an npm account to publish packages
3. **npm Access Token**: Required for automated publishing

## Setup Steps

### 1. Create npm Access Token

1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Click on your profile → "Access Tokens"
3. Click "Generate New Token"
4. Choose token type:

#### Option A: Classic Token (Recommended for CI/CD)
- Select "Classic Token"
- Choose "Publish" scope (allows publishing packages)
- This gives broad access but is simpler to set up

#### Option B: Granular Access Token (More Secure)
- Select "Granular Access Token"
- Set expiration (optional, but recommended)
- Under "Packages and scopes permissions":
  - Add your package: `docusaurus-numbered-headings`
  - Set permission to "Read and write"
- This is more secure as it's limited to specific packages

5. Copy the token (starts with `npm_`)
6. **Important**: Save this token securely - you won't be able to see it again!

### 2. Add npm Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click "Add secret"

### 3. Commit and Push the Workflows

The following workflows have been created:

- `.github/workflows/build.yml` - Runs on every push/PR (shows build status)
- `.github/workflows/ci.yml` - Full CI/CD pipeline with npm publishing
- `.github/workflows/release.yml` - Manual release workflow

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflows for CI/CD and npm publishing"
git push origin main
```

## How It Works

### Automatic Publishing (Method 1)

When you create a **GitHub Release**:
1. GitHub Actions will automatically run tests
2. Build the package
3. Publish to npm if tests pass

To create a release:
1. Go to your GitHub repo → Releases
2. Click "Create a new release"
3. Create a new tag (e.g., `v1.2.0`)
4. Add release notes
5. Click "Publish release"

### Manual Release Workflow (Method 2)

1. Go to your GitHub repo → Actions
2. Select "Release" workflow
3. Click "Run workflow"
4. Choose version bump type (patch/minor/major)
5. The workflow will:
   - Bump version in package.json
   - Create git tag
   - Create GitHub release
   - Publish to npm

### Manual Publishing (Method 3)

```bash
# Bump version
npm version patch  # or minor/major

# Publish to npm
npm publish
```

## Build Status Badge

The build status badge will now work:
```markdown
[![Build Status](https://github.com/t4dhg/docusaurus-numbered-headings/actions/workflows/build.yml/badge.svg)](https://github.com/t4dhg/docusaurus-numbered-headings/actions)
```

## Testing the Setup

After pushing the workflows:
1. Check GitHub Actions tab to see if workflows run
2. Make a small change and push to test the build
3. Create a test release to verify npm publishing

## Troubleshooting

- **Build fails**: Check the Actions logs for errors
- **npm publish fails**: Verify NPM_TOKEN secret is set correctly
- **Badge not showing**: Ensure the workflow file exists and has run at least once
