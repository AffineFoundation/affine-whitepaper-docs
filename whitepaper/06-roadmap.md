# 6. Roadmap

Five directions define the near- and medium-term development of the system. Each is tied to a specific limit of the current design, and each is sequenced so earlier items unblock later ones.

### Harder Evaluation Surfaces

The current suite spans the capability axes that matter today, but two frontiers are still lightly represented. One is long-horizon reasoning — tasks that require coherent plans spanning tens of tool calls or thousands of tokens, where most current environments cap episode length for throughput reasons. The other is multi-agent coordination, where the miner has to negotiate, cooperate, or compete with a second model rather than a scripted opponent. Both need new environment designs, not parameter tweaks, and both require the scoring pipeline to absorb higher per-task variance without destabilizing champion state.

### Higher Settlement Resolution

As the scored sample set grows, the Pareto and dethrone margins in [§3.2](03-mechanism/3.2-scoring.md) can tighten with sample size — $\text{SE} \propto 1/\sqrt{n}$, so the minimum-detectable capability gap shrinks. The current `PARETO_MARGIN = 4%` and `WIN_MARGIN = 2–3%` are conservative bounds that protect the system when $n$ is small; with a larger sample set and validated variance estimates, both can drop, letting the market price finer increments. Multi-dimensional Pareto comparisons across projected capability spaces and longer challenge windows follow from the same direction.

### Continued Anti-Exploit

The dual-signal detector in [§3.2](03-mechanism/3.2-scoring.md) runs on a 24-hour background cycle today. The near-term goal is to move it, or a faster proxy, inline — a flagged copy should be excluded from the current round's scoring, not merely surfaced for review. Alongside this: defenses against compound attacks that combine weak perturbations across multiple axes, and environment-internal anti-memorization that strengthens the renewal guarantees in [§5.2](05-environments/5.2-task-renewal.md) so even a miner trained against a full year of task history cannot convert that history into an edge.

### Opening Participant Roles

Environment authorship, validator operation, and the research/policy layer are team-operated today. Each becomes first-class permissionless in sequence, preserving settlement integrity. Environment authorship opens first — authors submit through the Affinetes pipeline, environments are staged and reviewed, eligible ones enter scoring with an on-chain stake. External validator operators come next, with governance around quorum and weight-vector consensus. The research/policy layer, which curates the suite and tunes scoring parameters, opens last. The order is conservative on purpose: opening settlement before environments would create a window where a malicious validator could reward exploiters faster than the environment pipeline could respond.

### Infrastructure Hardening

The inference layer today depends on Chutes. Near-term work is to build Affine-operated or hybrid GPU inference — not to replace Chutes but to reduce correlated-failure blast radius and give the operator direct levers during high-demand periods. Alongside this: per-environment per-miner health dashboards, task-pool saturation alerts, and reproducible replay of any settled round. Boundary clarity between the three layers ([§4.1](04-system-design/4.1-architecture.md)) should be hardened with versioned HTTP contracts so changes to one layer cannot silently break the others.

---

**Table 6.** Roadmap directions × current limit × expected impact.

| Direction | Current limit | Expected impact |
|---|---|---|
| **Harder evaluation surfaces** | Long-horizon and multi-agent lightly covered | Prices capabilities not currently differentiated |
| **Higher settlement resolution** | Pareto `gap` floor = 2%; single-axis dominance | Finer increments become settleable |
| **Continued anti-exploit** | Detector runs on 24-hour background cycle | Exploits caught in-round; compound attacks addressed |
| **Opening participant roles** | Authorship / validation / policy team-operated | Participation becomes permissionless in a settlement-safe order |
| **Infrastructure hardening** | Single third-party inference; observability gaps | Reduced correlated-failure risk; auditable replay |
