# Workspace Context

## Purpose

Workspace for the **Affine whitepaper** (Bittensor Subnet 120). The whitepaper describes the evaluation mechanism, system architecture, evaluation environments, scoring pipeline, and preliminary benchmark results.

## Content pipeline

`whitepaper/raw-content/draft.md` is the source of truth for the published whitepaper and any future paper. Only markdown files under `whitepaper/` should be connected for whitepaper rendering and front-end usage pipeline. The structured section files (`whitepaper/0N-*/`) are derived from the draft and organized for modular editing and review.

## Reference pointers

- **Live system config API:** `https://webapi.affine.io/api/v1/system/config` — canonical environment list. Re-fetch before writing §5 or §9.
- **Live dashboard:** https://www.affine.io/
- **GitHub organization:** https://github.com/AffineFoundation
  - `affine` — core protocol (validator/miner logic, scoring, anti-copy, teacher pipeline, `af` CLI)
  - `affinetes` — environment runner orchestration
  - `affine-swe-infinite` — SWE task generation pipeline
  - `affine-benchmark` — GPU cluster benchmarking
  - `docs` — official Mintlify documentation
- **Getting Started:** https://github.com/AffineFoundation/affine-cortex#getting-started
- **Miner docs:** https://github.com/AffineFoundation/affine-cortex/blob/main/docs/MINER.md
- **Validator docs:** https://github.com/AffineFoundation/affine-cortex/blob/main/docs/VALIDATOR.md
- **Twitter:** https://x.com/affine_io
- **Discord:** https://discord.com/invite/3T9X4Yn23e

## Active environment list (verified 2026-04-10)

| Env | Display | Sampling | Scoring | Weight | Count | Min completeness |
|---|---|---|---|---|---|---|
| GAME | GAME | yes | yes | **3** | 300 | 0.85 |
| MEMORY | MEMORY | yes | yes | 1 | 200 | 0.80 |
| LIVEWEB | LIVEWEB | yes | yes | 1 | 200 | 0.80 |
| NAVWORLD | NAVWORLD | yes | yes | 1 | 200 | 0.85 |
| SWE-INFINITE | SWE | yes | yes | 1 | 130 | 0.60 |
| DISTILL | DISTILL | yes | yes | 1 | 80 | 0.60 |
| LOGPROBS | LOGPROBS | yes | **no** | 1 | 50 | 0.90 |
