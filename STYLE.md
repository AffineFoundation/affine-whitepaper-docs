# Writing Guide

Unified rules every coding agent and contributor follows when drafting the Affine whitepaper. Read once, then forget — they should feel natural after one section.

## File and folder structure

- One **section** per folder under `whitepaper/`, named `0N-short-name/` (e.g. `whitepaper/03-mechanism/`).
- One **subsection** per file inside that folder, named `N.M-short-name.md` (e.g. `whitepaper/03-mechanism/3.1-the-flywheel.md`).
- Each file is approximately **one printed page** (≈ 500–800 words). Going over is fine if the topic needs it; going under is fine if the topic is short.
- **No sub-subsection files.** §8.4 is the longest subsection in the paper but it is still one file (`8.4-distillation-pipeline.md`); its internal structure is captured as titled paragraphs inside that file, not as H3/H4 headings or separate files.
- Figure source files live in `whitepaper/figures/` (created on demand). Naming: `figN-M-short-name.{mmd,svg,png,py}`.

## Heading levels

Inside each subsection file:

- **H1 (`#`)** is the subsection title with its number, e.g. `# 3.1 The flywheel`. Always present, exactly once per file.
- **No H2, H3, or H4 inside subsection files.** Internal structure is expressed as **titled paragraphs**, not as nested headings (see next section).

## Titled paragraphs

Every paragraph in a subsection file starts with a **short bold lead-in title** followed by a period and the body text on the same line:

```
**Centrally produced.** A small number of organizations control the compute,
the data, and the evaluation. Capability gains accrue to private balance
sheets, and outsiders have no credible way to contribute.
```

Rules:

- Lead-in titles are **2–4 words**. They function as inline mini-headings the reader can skim.
- One title per paragraph. If a paragraph has no natural title, the paragraph probably belongs combined with the one before or after it.
- Even single-paragraph files use a lead-in title (the file's H1 is the page name; the lead-in title is the paragraph's name).
- Use sentence case for lead-in titles, not Title Case.

## Page-level layout

A typical subsection file contains, in order:

1. **H1 title** with the subsection number.
2. **One-line draft banner** noting it is a draft and who owns it (remove once finalized).
3. **2–6 titled paragraphs** of prose, ~500–800 words total.
4. **0–2 figures** with captions (see Figures below).
5. **Cross-references** at the bottom (optional, only if the page forward- or back-references other sections).

You can deviate when the topic calls for it. The point is consistency, not rigidity.

## Figures

- **Default tools by figure type:**
  - **Mermaid** for flowcharts, sequence diagrams, state machines, ER, gantt, mindmap. Renders in VSCode preview (with `bierner.markdown-mermaid` extension), GitHub, and pandoc. Embed inline as ` ```mermaid ` blocks.
  - **Excalidraw** for informal architecture diagrams. Source `.excalidraw` (JSON) + `.svg` export, both checked in to `whitepaper/figures/`.
  - **D2** or **PlantUML** for formal layered diagrams that exceed Mermaid's grammar.
  - **matplotlib / seaborn** for any chart that uses real data. Script + output PNG, both checked in.
- **Embedding:** for non-Mermaid figures, use `![Fig N.M caption](../figures/figN-M-name.svg)`.
- **Captions:** every figure has a one-sentence caption immediately below it: `**Fig N.M.** What the reader should take away.`
- **Numbering:** stable across edits — don't renumber figures when sections move; update outline references instead.

## Uncertainty markers

Inline, use exactly these three markers so they can be grepped later:

- `[TBD: ...]` — facts you can verify by reading source code, fetching an API, or checking the dashboard
- `[NEEDS-INPUT: ...]` — things only Nick or the team can answer (license, founding story, dates, tokenomics)
- `[NEEDS-EXPERT: ...]` — things only another section's owner or specialist can write
- `*TODO* — ...` — work the current owner needs to come back and finish (figures to build, paragraphs to flesh out, prose to revise)

## Cross-references

- To another section: `§N` or `§N.M` (e.g. `see §6.4 for the anti-copy gate`).
- As a markdown link when pointing to a specific file: `[§6.4](../06-scoring/6.4-anti-copy-detection.md)`.
- Forward references are fine and expected; the reader is going through the doc in order.

## Tone

- Whitepaper register: technical but accessible. The reader is a smart engineer or researcher who is unfamiliar with Bittensor.
- First-person plural ("we") is fine for design rationale ("we chose Pareto because…"). Avoid first-person singular.
- Avoid marketing language. Affine is a serious technical artifact; let the mechanism speak.
- Define acronyms on first use within each section (Bittensor, TAO, dTAO, RL, SFT, DPO, KL, etc.).
- Math is welcome where it helps. Inline `$x$`; display `$$ ... $$`. Pandoc handles both.

## Formatting

- **Source format:** pure Markdown. No MDX, LaTeX, or Typst at the source layer. Inline LaTeX-flavored math is fine (`$ ... $`).
- **No emojis** unless explicitly requested by Nick.
- **No `Co-Authored-By` lines** in commits. Use your own git author.
- **Don't push to `main`.** Always work on a branch and open a PR.

## When in doubt

Mirror an existing section that you find well-written. Consistency across the whitepaper matters more than any single rule above.
