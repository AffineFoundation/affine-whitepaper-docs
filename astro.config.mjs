// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import rehypeMermaid from 'rehype-mermaid';

export default defineConfig({
  site: 'https://docs.affine.io',
  markdown: {
    rehypePlugins: [
      [rehypeMermaid, { strategy: 'pre-mermaid' }]
    ],
    syntaxHighlight: 'shiki',
  },
  integrations: [
    starlight({
      title: 'Affine',
      favicon: '/favicon-dynamic.svg',
      head: [
        // Google Fonts: Inter + IBM Plex Mono
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
        { tag: 'link', attrs: { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap' } },
        // Mermaid scripts
        { tag: 'script', attrs: { src: '/scripts/mermaid-themer.js', defer: true } },
        { tag: 'script', attrs: { src: '/scripts/mermaid-expander.js', defer: true } },
        // OG image
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://docs.affine.io/affine_OpenGraph_Dark_bg.png' } },
      ],
      logo: {
        src: './src/assets/affine-logo-white.svg',
      },
      customCss: ['./src/styles/custom.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/AffineFoundation' },
        { icon: 'x.com', label: 'X', href: 'https://x.com/affine_io' },
      ],
      sidebar: [
        { label: 'Abstract', slug: 'index' },
        { label: 'Introduction', slug: 'introduction' },
        {
          label: 'Mechanism',
          items: [
            { label: '3.1 System Participants & Roles', slug: 'mechanism/system-participants' },
            { label: '3.2 Task Lifecycle', slug: 'mechanism/task-lifecycle' },
            { label: '3.3 Evaluation Loop & Sampling', slug: 'mechanism/evaluation-loop' },
            { label: '3.6 Design Rationale', slug: 'mechanism/design-rationale' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: '4.1 Architectural Overview', slug: 'architecture/overview' },
            { label: '4.2 Environment Layer (Affinetes)', slug: 'architecture/affinetes' },
            { label: '4.3 Inference Layer', slug: 'architecture/inference-layer' },
            { label: '4.4 OpenEnv Protocol', slug: 'architecture/openenv-protocol' },
            { label: '4.5 Logprob Collection', slug: 'architecture/logprob-collection' },
            { label: '4.6 Execution Flow', slug: 'architecture/execution-flow' },
            { label: '4.7 Scalability & Reproducibility', slug: 'architecture/scalability' },
          ],
        },
        {
          label: 'Environments',
          items: [
            { label: '5.0 Environment Overview', slug: 'environments/overview' },
            { label: '5.1 SWE-Infinite', slug: 'environments/swe-infinite' },
            { label: '5.2 LiveWeb Arena', slug: 'environments/liveweb-arena' },
            { label: '5.3 MemoryGym', slug: 'environments/memorygym' },
            { label: '5.4 NavWorld-QQR', slug: 'environments/navworld' },
            { label: '5.5 Game (OpenSpiel)', slug: 'environments/openspiel' },
            { label: '5.6 DISTILL', slug: 'environments/distill' },
          ],
        },
        {
          label: 'Scoring',
          items: [
            { label: '6.1 Scoring Pipeline', slug: 'scoring/scoring-pipeline' },
            { label: '6.2 Anti-Plagiarism', slug: 'scoring/anti-plagiarism' },
          ],
        },
        {
          label: 'Mining Tutorial',
          items: [
            { label: '7.1 Miner Workflow', slug: 'mining-tutorial/miner-workflow' },
            { label: '7.2 Training Philosophy', slug: 'mining-tutorial/training-philosophy' },
          ],
        },
        {
          label: 'Training',
          items: [
            { label: '8.1 DISTILL Pipeline', slug: 'training/distill-pipeline' },
            { label: '8.2 Reward Signal Design', slug: 'training/reward-signal' },
          ],
        },
        {
          label: 'Benchmarks',
          items: [
            { label: '9.0 Benchmark Overview', slug: 'benchmarks/overview' },
            { label: '9.1 Stable Benchmarks', slug: 'benchmarks/stable-benchmarks' },
            { label: '9.2 Snapshot Benchmarks', slug: 'benchmarks/snapshot-benchmarks' },
            { label: '9.3 Code Generation', slug: 'benchmarks/code-generation' },
            { label: '9.4 Interpretation', slug: 'benchmarks/interpretation' },
          ],
        },
        {
          label: 'Roadmap',
          items: [
            { label: '10.0 Roadmap Overview', slug: 'roadmap/overview' },
            { label: '10.1 Model Architecture Scaling', slug: 'roadmap/model-scaling' },
            { label: '10.2 Distillation Evolution', slug: 'roadmap/distillation-evolution' },
            { label: '10.3 Inference Independence', slug: 'roadmap/inference-independence' },
            { label: '10.4 Environment Expansion', slug: 'roadmap/environment-expansion' },
            { label: '10.5 Scoring Refinement', slug: 'roadmap/scoring-refinement' },
            { label: '10.6 Conclusion', slug: 'roadmap/conclusion' },
          ],
        },
      ],
    }),
  ],
});
