# Affine Whitepaper — Outline (v3)

Organizing principle: flat, topic-first section titles (Bittensor-whitepaper style). No rhetorical "goal" chapters, no redundant cross-chapter framing, no openness-disclosure chapter separate from the problem statement. Every subsection is named for the technical artifact it specifies, not for the role it plays in the argument.

Hard rules for this draft:

- §1–§2 together ≤ 3 pages. Readers must reach §3 before page 4.
- Every subsection title is a noun or noun phrase naming the artifact, not a sentence.
- No subsection exists only to set up another subsection — each earns its place by describing a distinct technical object.
- Openness/centralization disclosures live inside the sections they describe, not in a separate chapter.
- Core thesis is stated once (§2.1 + §2.3) and then operationalized; no "Core Thesis" chapter.

---

## Table of Contents

1. **Abstract**
2. **Introduction**
   - 2.1 Vision
   - 2.2 Problem
   - 2.3 Affine Solution
3. **Mechanism**
   - 3.1 Participants
   - 3.2 Scoring (includes anti-exploit and settlement)
4. **System Design**
   - 4.1 Architecture
   - 4.2 Affinetes
   - 4.3 Inference Layer
5. **Environments**
   - 5.1 Design Criteria
   - 5.2 Task Renewal
   - 5.3 Environment Suite
   - 5.4 Training Interface
6. **Roadmap**
7. **Conclusion**

---

## 1. Abstract

Single paragraph, ~250 words. The paragraph opens by stating that Affine advances open-source reasoning models through incentivized miner RL post-training, and anchors that activity on Bittensor Subnet 120 so model gains can be continuously discovered, verified, and rewarded in public. Renewable RL environments are introduced naturally in the course of explaining *how* — they are the substrate miners train against and the system evaluates on — rather than being declared a thesis. *Why it matters*: static benchmarks saturate and open ecosystems lack a settlement layer that can price real increments. *How it works*: a one-sentence pass through multi-environment Pareto + ELO scoring and anti-exploit defenses, with transparent on-chain weights (see [§3](#3-mechanism)). The paragraph closes with concrete empirical numbers showing that miner-trained models beat the base model on external benchmarks not used in training.

**Format.** Pure prose, single paragraph. No lists, no figures. Version line above the paragraph.

---

## 2. Introduction

Hard length budget: §2 total ≤ 2 pages.

### 2.1 Vision

- ¶1: Open-source reasoning has lagged behind closed labs because the open ecosystem has no shared engine that turns distributed training effort into verifiable capability gains. Affine is built to fill that gap: miners run RL post-training and release measurably stronger models, and the system around them — a public incentive layer on Bittensor Subnet 120 — keeps that production running without any single organization in charge.
- ¶2: The rewarding side of the loop matters because, without it, real improvements would either go unrecognized or get absorbed back into closed systems. Putting discovery, verification, and reward on a public network is what converts isolated training runs into a continuously moving open frontier.
- ¶3: A natural mention that the models are trained and scored against a curated set of renewable environments — strong enough to matter, hard enough not to saturate. The environments are introduced as the ground the loop runs on, not as a separate manifesto.
- ¶4: Scope exclusion — Affine is not a leaderboard, not a closed lab, not a single-model project. It is long-running infrastructure for open reasoning progress.

**Length.** ≈0.5 page. **Fig 2.1:** the open-source model production loop — miners post-train, release, and compete for on-chain rewards that fund the next round, with the environment substrate underneath.

### 2.2 Problem

Why open-source models lag behind, and why the open ecosystem cannot compound reasoning progress on its own.

- ¶1: RL post-training is the single most important technique for advancing model reasoning, coding ability, and general intelligence. From AlphaGo's self-play to the post-2024 reasoning jump (OpenAI o-series, DeepSeek R1, Qwen 3), the pattern is the same: models improve by training against verifiable reward signals in structured environments, not by scaling pretraining data alone.
- ¶2: But the core RL post-training techniques and infrastructure are concentrated inside a few closed-source organizations — OpenAI, Anthropic, Google DeepMind, and their peers. Open-source models receive the checkpoints but not the training loop that produced them. The gap is not in model weights but in the post-training pipeline and the environments that drive it.
- ¶3: Meanwhile, open-source evaluation has its own failure mode. Static benchmarks saturate and leak into training data; leaderboards rank results but cannot distinguish a real improvement from noise, contamination, or a near-duplicate of yesterday's leader. Without a mechanism that settles verified increments, the open ecosystem has no stable signal to optimize against.
- ¶4: The missing layer is economic: a public settlement mechanism that prices verified increments, rejects noise and copying, and keeps producing signal as individual benchmarks saturate. Affine is constructed to be that layer.

**Length.** ≈0.75 page. Prose only — no lists. Light on formal citations; well-known facts (AlphaGo, DeepSeek R1, o1) do not need citation. At most 1–2 references where a specific claim benefits from it.

### 2.3 Affine Solution

Compressed "how." [§3](#3-mechanism)–[§7](#7-roadmap) each expand one piece.

- ¶1: Affine operates as Bittensor Subnet 120. Three operational pieces — environment production ([§5](#5-environments)), miner RL post-training (permissionless), multi-environment scoring + on-chain settlement (transparent) ([§3](#3-mechanism)).
- ¶2: What defends the settlement against copy-and-submit and other exploit patterns: Pareto filtering plus a dual-signal anti-copy detector ([§3.4](#34-anti-exploit)).
- ¶3: What shows the loop is real: [§6](#6-evaluation) — miner models outperform the base Qwen3-32B on external benchmarks not used in training.

**Length.** ≈0.5 page. **Fig 2.3:** three-layer system overview with on-chain anchor.

---

## 3. Mechanism

How the market values models. Everything about *what the market rewards and how it converts scores into economic facts* lives here.

### 3.1 Participants

- Miners — permissionless participants who train, host, and commit models. Workflow: `af pull` → RL post-training → deploy on HuggingFace / Chutes → commit metadata on-chain. One active commitment per hotkey. Fixed Qwen3-32B architecture; no quantization. See the [Miner complete guide](https://github.com/AffineFoundation/affine-cortex/blob/main/docs/MINER.md).
- Validators — blockchain-registered nodes responsible for the full evaluation-to-settlement path: they run the scheduler, executor, scorer, and anti-copy detector that drive the Champion Challenge pipeline in [§3.2](#32-scoring-champion-challenge), then submit the single-recipient weight vector on-chain. Scoring outputs are publicly observable and on-chain anchored. See the [Validator complete guide](https://github.com/AffineFoundation/affine-cortex/blob/main/docs/VALIDATOR.md).

**Length.** ≈0.75 page. **Table 3.1:** participants × function × trust model × key constraint.

### 3.2 Scoring

Winner-takes-all scoring pipeline: a single reigning champion holds 100% of emission weight, and challengers must first survive a pairwise anti-copy filter and then dominate the champion at a qualifying checkpoint before taking the crown. Anti-exploit defense and on-chain settlement are handled as subsections inside this same pipeline, not as separate mechanisms.

- **Stage 1 — Data collection.** Per-miner per-environment averages; env-specific range normalization to [0, 1].
- **Stage 2 — Champion challenge.** Six phases, executed in order:
  - *Champion resolution.* Identify the reigning champion by hotkey + revision. The crown persists through temporary absence.
  - *Pairwise Pareto filter.* For every non-champion miner pair sharing ≥ `PARETO_MIN_WINDOWS × window_size` common tasks (default `PARETO_MIN_WINDOWS = 3`), run strict Pareto comparison at `PARETO_MARGIN = 4%`; dominated miners are permanently terminated. Registration order (`first_block`) settles incumbency both ways — an earlier miner that dominates eliminates the later one, and a later miner that dominates eliminates the earlier one.
  - *Checkpoint-gated comparisons.* `CP = min_common_tasks // window_size`. Each comparison requires a new CP, guaranteeing each check runs on a meaningfully different sample.
  - *Dominance check.* The challenger must exceed the champion in at least `WIN_MIN_DOMINANT_ENVS = 3` environments by `WIN_MARGIN`, scaling linearly from `WIN_MARGIN_START = 2%` at CP = warmup+1 to `WIN_MARGIN_END = 3%` at CP = `CHAMPION_DETHRONE_MIN_CHECKPOINT = 10`; remaining environments must not be worse.
  - *Dethrone.* Qualifies when `CP ≥ 10` and the most recent comparison was a win. Tiebreaker: earliest `first_block`, then highest geometric mean (with `GEOMETRIC_MEAN_EPSILON = 0.1`). First `CHAMPION_WARMUP_CHECKPOINTS = 2` are logged but not counted.
  - *Termination.* Permanent on `CHAMPION_TERMINATION_TOTAL_LOSSES = 3` total or `CHAMPION_TERMINATION_CONSECUTIVE_LOSSES = 2` consecutive post-warmup losses. Loss at CP ≥ 10 terminates immediately.
- **Stage 3 — Weight assignment.** Champion = 1.0; everyone else = 0.0. Absent champion still receives full weight on its stored UID.

**3.2.a — Anti-Exploit (brief).** Most exploit resistance comes from Stage 2 itself: (1) the pairwise Pareto filter permanently terminates strict copies because a copy cannot clear 4% in every environment; (2) a background dual-signal anti-copy detector (hidden-state cosine + top-k logprob, ≥ 30 shared tasks) flags structural duplicates on a 24-hour cycle; (3) the champion's defender advantage — a copy cannot clear `WIN_MARGIN` at CP ≥ 10 by reproducing scores — makes dethroning by imitation unprofitable.

**3.2.b — Settlement.** The single-recipient weight vector from Stage 3 is submitted on-chain by validators. Yuma Consensus aggregates stake-weighted medians across validators; emissions flow to the champion hotkey. Safety valve: champion weight can be redirected to UID 0 (burn) during incidents, pausing emission without dismantling champion state. Formula: $\mathrm{Reward}_{\mathrm{champion}} = 1,\; \mathrm{Reward}_{i \neq \mathrm{champion}} = 0$.

**Length.** ≈3.5 pages. **Fig 3.2:** champion challenge pipeline. **Table 3.2:** Champion Challenge parameters (`PARETO_MARGIN`, `PARETO_MIN_DOMINANT_ENVS = 0`, `PARETO_MIN_WINDOWS`, `WIN_MARGIN_START`, `WIN_MARGIN_END`, `WIN_MIN_DOMINANT_ENVS`, `GEOMETRIC_MEAN_EPSILON`, `CHAMPION_WARMUP_CHECKPOINTS`, `CHAMPION_DETHRONE_MIN_CHECKPOINT`, `CHAMPION_TERMINATION_TOTAL_LOSSES`, `CHAMPION_TERMINATION_CONSECUTIVE_LOSSES`).

---

## 4. System Design

The engineering that makes §3 deployable.

### 4.1 Architecture

Three-layer decomposition and why the layers are separable.

- ¶1: Coordination layer (affine-cortex) — task pool, executor, scorer, anti-copy. Drives the loop from §3.2.
- ¶2: Environment layer (Affinetes) — containerized evaluation services. Details in §4.2.
- ¶3: Inference layer (Chutes, today) — model serving via OpenAI-compatible HTTP. Details in §4.3.
- ¶4: Separation rationale — environments are CPU-bound; inference is GPU-bound; independent scaling, clean backend substitution, no shared state.

**Length.** ≈1 page. **Fig 4.1:** three-layer diagram with on-chain anchor.

### 4.2 Affinetes

Environment containerization framework.

- ¶1: Zero-burden principle — environment authors write `env.py` with business logic; framework handles image build, HTTP server injection, deployment, networking, cleanup.
- ¶2: Two environment styles — function-based (`Actor` class, auto-exposed methods) and HTTP-native (existing FastAPI app detected automatically).
- ¶3: Three deployment modes — Docker (default, SSH-tunneled), URL (HTTP proxy to managed infra), Basilica (per-session Kubernetes pods).
- ¶4: Multi-instance scaling — instance pool behind a load balancer; horizontal scaling without calling-code changes.

**Length.** ≈1 page. **Table 4.2:** three deployment modes × backend × networking × use case.

### 4.3 Inference Layer

Chutes today; Affine-operated tomorrow.

- ¶1: Chutes (Subnet 64) hosts miner models as OpenAI-compatible endpoints.
- ¶2: Clean HTTP boundary — environments contain no model-loading, GPU management, or inference optimization. They issue chat completion requests and receive text.
- ¶3: Backend substitutability — same environment code works against Basilica, Targon, or self-operated endpoints. Only the base URL changes.
- ¶4: Forward reference to §7 for the path to Affine-operated inference clusters.

**Length.** ≈0.75 page.

---

## 5. Environments

High-quality environments are Affine's core asset. This section defines what "high-quality" means, the task-renewal property, the current suite, and the training interface that closes the evaluation-to-training loop.

### 5.1 Design Criteria

Five properties every Affine environment must satisfy.

- ¶1: Real task structure — reflects real problem surfaces, not toy test sets.
- ¶2: Verifiable scoring — no human-in-the-loop at scoring time; structured reward signals.
- ¶3: Anti-contamination — procedural generation, held-out splits, or real-time data; saturation-resistant by design.
- ¶4: Bounded per-task compute — hard wall-clock and token budget.
- ¶5: Diverse failure modes — each environment forces a distinct capability axis; inter-environment overlap is a cost.

**Length.** ≈0.75 page. **Table 5.1:** five properties × how each current environment satisfies them.

### 5.2 Task Renewal

The single choice that differentiates Affine environments from fixed benchmarks.

- ¶1: Static datasets saturate in training epochs, not years.
- ¶2: Renewable generation — SWE-Infinite mines GitHub PRs, LiveWeb Arena draws live data, MemoryGym regenerates worlds per seed, OpenSpiel draws seed-indexed game trajectories, DISTILL teacher rollouts grow continuously.
- ¶3: Consequence for training — the environment is a legitimate RL training substrate.
- ¶4: Consequence for scoring — miners cannot overfit because the test distribution has already moved.

**Length.** ≈0.75 page.

### 5.3 Environment Suite

Six active environments. One titled paragraph each: capability axis, task-generation mechanism, reward structure, one scale anchor.

- **SWE-Infinite.** Software engineering; GitHub PR mining; binary pass/fail on FAIL_TO_PASS + PASS_TO_PASS tests; ≥ 1,200 validated tasks/day at 5-machine cluster.
- **LiveWeb Arena.** Browser-grounded web interaction; live data + combinatorial templates; shaped step rewards + terminal bonus; 197M+ task configurations.
- **MemoryGym.** Memory management under write budgets; seed-based world generation + correction events; four-axis composite scoring; 10 domain templates.
- **NavWorld.** Tool-mediated planning (6 MCP tools); SHA256-seeded mock transport + weekly salt rotation; 100-point rubric blending code-verifiable + LLM-judged; 10,000+ tasks across 71 cities.
- **OpenSpiel.** Strategic reasoning across 22 games; game rules + seeded opponents; normalized outcome ∈ [0, 1]; trajectory space > 10^60.
- **DISTILL.** Distributional alignment; teacher rollouts from top miners; per-token KL divergence → score = exp(−avg_kl); self-expanding rollout pool.

**DISTILL gets an additional 0.5 page** for its three-stage teacher/mover/student pipeline, which is structurally distinct from the other five and warrants its own figure. **Fig 5.3:** DISTILL pipeline.

**Length.** ≈3 pages total for the suite (0.5 page per environment, plus 0.5 for DISTILL figure). **Table 5.3:** suite summary grid — environment × capability × generation mechanism × reward type × scale anchor.

### 5.4 Training Interface

How environments become training substrates.

- ¶1: Deterministic seeding — same seed + task_id + model produces identical evaluation trajectories.
- ¶2: Reward granularity spectrum — dense per-step (LiveWeb, NavWorld), per-task binary (SWE-Infinite), per-position distributional (DISTILL). Miners select granularity to match their RL method.
- ¶3: Affinetes exposes a gym-compatible multi-turn interface (`reset / step / stop`) over HTTP.
- ¶4: Closing the loop — the same environment that scored a miner is the one they train against to produce the next submission. This is what makes the market compound.

**Length.** ≈1 page. **Table 5.4:** reward granularity × environment × example RL method that fits.

---

## 6. Roadmap

Five directions, each tied to a specific limit the current system has. Plain prose, no subsections.

- ¶1: **Harder evaluation surfaces.** More task complexity inside existing environments; new environments covering long-horizon reasoning, multi-agent coordination, and domains not yet represented.
- ¶2: **Higher settlement resolution.** Tighter statistical thresholds as sample sizes grow; richer multi-dimensional Pareto comparisons; longer ELO temporal windows.
- ¶3: **Continued anti-exploit.** Anti-copy integration into inline scoring (not just background audit); defenses against compound attacks; environment-internal anti-memorization.
- ¶4: **Opening participant roles.** Environment authorship as first-class participation; external validator operators; research/policy layer. Opening order constrained by settlement-integrity preservation.
- ¶5: **Infrastructure hardening.** Affine-operated or hybrid GPU clusters; better observability; cross-component boundary clarity.

**Length.** ≈2 pages. **Table 6:** each direction × current limit × expected impact.

---

## 7. Conclusion

One page. Restate the thesis in new words (environments as core asset → miner RL post-training → open market for verified increments); acknowledge what remains open (see [§6](#6-roadmap)); close with the framing that open reasoning progress should not be a property of a few closed labs but of a continuously-running public system.

---

## Appendix notes

- **Length target.** §1 (1) + §2 (2) + §3 (7.5) + §4 (3.5) + §5 (5.5) + §6 (2) + §7 (1) ≈ **22.5 pages** of prose, ≈ **25–27 pages** with figures and tables. Bittensor whitepaper is ~14 pages; we are denser, which is appropriate for a system this large.
- **Internal cross-refs.** Every §X reference in this outline must become a real markdown anchor link in the final paper (e.g., `[§3.4](#34-anti-exploit)`), so readers can jump. Carried through consistently in this v3.
- **Total figures.** 4 (2.1, 2.3, 3.2, 4.1, 5.3). Every figure earns its place.
- **Total tables.** 8 (3.1, 3.3, 3.4, 3.5, 4.2, 5.1, 5.3, 5.4, 6). Every table is a compression of what would otherwise be a bullet list.
- **What was cut.** Standalone "Core Thesis" chapter (folded into §2.1 and §2.3). Standalone "Today's Openness" chapter (merged into §2.2 and §3.1). Standalone "Evaluation" chapter (§6 in previous draft) — the empirical results will be threaded into the prose where relevant or handled as a separate, more deeply-reviewed section later; not in this outline.
- **Cross-section discipline.** §3 owns "how the market values models." §4 owns "how the market is built." §5 owns "what the market runs on." §6 owns "where the market is going." No chapter redescribes what a previous chapter has established.
- **Open questions for review.**
  1. Do the §3.3 formulas belong in the outline, or should they be marked `[see code reference]` and worked into the prose when drafting?
  2. §5.3 — six environments in one page with one table each, or six short subsections? Current choice: one subsection with six titled paragraphs + one summary table + a dedicated figure for DISTILL.
  3. §6 — does the roadmap need per-direction subsections, or is the five-paragraph prose layout enough? Current choice: prose only.
