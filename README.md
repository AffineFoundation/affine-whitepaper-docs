# Affine Whitepaper & Documentation

Astro/Starlight documentation site for the Affine whitepaper, deployed at [docs.affine.io](https://docs.affine.io).

## Development

```bash
npm install
npm run dev        # Start dev server at localhost:4321
npm run build      # Production build → dist/
npm run preview    # Preview production build
```

## Content Workflow

Engineers edit markdown files in the `whitepaper/` directory. The conversion script transforms them into MDX:

```bash
npm run convert    # Convert whitepaper/*.md → src/content/docs/*.mdx
```

### Automated via GitHub Actions

When changes are pushed to `whitepaper/**/*.md` on `main`, the workflow:
1. Runs the conversion script
2. Validates the build
3. Creates a PR with the generated MDX changes

For auto-merge (skip PR review), use the manual workflow dispatch with "auto-merge" mode.

## Project Structure

```
whitepaper/              ← Source markdown (engineers edit here)
  01-abstract/
  02-introduction/
  ...
  10-roadmap/
src/content/docs/        ← Generated MDX (committed, auto-generated)
scripts/
  convert-whitepaper.mjs ← MD → MDX conversion script
```

## Tech Stack

- [Astro](https://astro.build) 5.6 + [Starlight](https://starlight.astro.build) 0.34
- Mermaid diagrams (client-side rendering with zoom/pan)
- Affine design system (dark theme, Inter font)
