# GitHub Actions & Workflows

This project has two independent workflows — one for the whitepaper, one for the subnet docs. They never touch each other's files.

---

## 1. Whitepaper Content Updates

**Workflow file:** `.github/workflows/whitepaper-update.yml`

### How it triggers

Automatically — whenever someone pushes changes to any `.md` file inside `whitepaper/` on the `main` branch.

Can also be triggered manually from the Actions tab.

### What it does

1. Runs `node scripts/convert-whitepaper.mjs` to convert source markdown into MDX
2. Checks if any MDX files actually changed
3. Builds the site to validate nothing is broken
4. Creates a PR with the changes (default), or auto-merges if you chose that option

### How engineers use it

1. Edit any file in `whitepaper/` (e.g. `whitepaper/03-mechanism/3.1-system-participants-and-roles.md`)
2. Commit and push to `main`
3. The workflow runs automatically and opens a PR titled "docs: Whitepaper content update"
4. Review and merge the PR — the server auto-deploys from `main`

### Skip the PR (faster, less safe)

1. Go to **Actions** tab on GitHub
2. Click **Whitepaper Content Update**
3. Click **Run workflow** → set mode to `auto-merge`
4. Changes go straight to `main` without a PR

### What goes where

| Source files | Output files |
|---|---|
| `whitepaper/01-abstract/*.md` | `src/content/docs/index.mdx` |
| `whitepaper/03-mechanism/*.md` | `src/content/docs/mechanism/*.mdx` |
| `whitepaper/04-architecture/*.md` | `src/content/docs/architecture/*.mdx` |
| ... | ... |

---

## 2. Subnet Documentation Updates

**Workflow file:** `.github/workflows/deepwiki-update.yml`

### How it triggers

Manual only — someone clicks "Run workflow" in the Actions tab. This is intentional because it scrapes an external site (DeepWiki) which takes ~15 seconds with a headless browser.

### Inputs you provide

| Input | Default | Description |
|---|---|---|
| `deepwiki_url` | `https://deepwiki.com/AffineFoundation/affine-cortex` | Which DeepWiki to scrape |
| `github_url` | `https://github.com/AffineFoundation/affine-cortex` | Repo for source file links |
| `git_ref` | `main` | Branch/tag/commit for source links |
| `mode` | `pr` | `pr` (creates a PR) or `auto-merge` (commits directly) |

### What it does

1. Installs Python, Chrome, and Selenium
2. Runs `python scripts/ingest-deepwiki.py` — scrapes DeepWiki nav + content, converts to MDX
3. Builds the site to validate
4. Creates a PR or auto-merges based on your choice

### How to run it

1. Go to **Actions** tab on GitHub
2. Click **DeepWiki Subnet Docs Update**
3. Click **Run workflow**
4. Fill in the inputs (or keep defaults for affine-cortex)
5. Click the green **Run workflow** button
6. Wait ~2 minutes for scraping + build
7. Review and merge the PR

### Running locally

```bash
pip install -r requirements.txt

python3 scripts/ingest-deepwiki.py \
  --url https://deepwiki.com/AffineFoundation/affine-cortex \
  --github https://github.com/AffineFoundation/affine-cortex \
  --output src/content/docs/subnets \
  --prefix subnets
```

### What goes where

All subnet docs go into `src/content/docs/subnets/`. The directory structure is auto-generated from DeepWiki's navigation hierarchy:

```
src/content/docs/subnets/
  index.mdx                          (Overview)
  api-reference/
  backend-services-deep-dive/
  cli-reference/
  database-storage/
  deployment-guide/
  developer-guide/
  evaluation-environments/
  for-miners/
  for-validators/
  getting-started/
  sdk-reference/
  system-architecture/
  troubleshooting-faq.mdx
```

---

## Quick Reference

| | Whitepaper | Subnet Docs |
|---|---|---|
| **Source** | `whitepaper/*.md` (in repo) | DeepWiki (external scrape) |
| **Script** | `convert-whitepaper.mjs` (Node) | `ingest-deepwiki.py` (Python) |
| **Output** | `src/content/docs/` | `src/content/docs/subnets/` |
| **Trigger** | Auto on push to `whitepaper/` | Manual from Actions tab |
| **Workflow** | `whitepaper-update.yml` | `deepwiki-update.yml` |
| **npm script** | `npm run convert` | `npm run ingest:subnets` |
