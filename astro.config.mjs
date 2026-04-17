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
      components: {
        Header: './src/components/Header.astro',
        Sidebar: './src/components/Sidebar.astro',
      },
      customCss: ['./src/styles/custom.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/AffineFoundation' },
        { icon: 'x.com', label: 'X', href: 'https://x.com/affine_io' },
      ],
      sidebar: [
        { label: '1. Abstract', slug: 'index' },
        {
          label: '2. Introduction',
          items: [
            { label: '2.1 Vision', slug: 'introduction/vision' },
            { label: '2.2 Problem', slug: 'introduction/problem' },
            { label: '2.3 Affine Solution', slug: 'introduction/solution' },
          ],
        },
        {
          label: '3. Mechanism',
          items: [
            { label: '3.1 Participants', slug: 'mechanism/participants' },
            { label: '3.2 Scoring', slug: 'mechanism/scoring' },
          ],
        },
        {
          label: '4. System Design',
          items: [
            { label: '4.1 Architecture', slug: 'system-design/architecture' },
            { label: '4.2 Affinetes', slug: 'system-design/affinetes' },
            { label: '4.3 Inference Layer', slug: 'system-design/inference-layer' },
          ],
        },
        {
          label: '5. Environments',
          items: [
            { label: '5.1 Design Criteria', slug: 'environments/design-criteria' },
            { label: '5.2 Task Renewal', slug: 'environments/task-renewal' },
            { label: '5.3 Environment Suite', slug: 'environments/suite' },
            { label: '5.4 Training Interface', slug: 'environments/training-interface' },
          ],
        },
        { label: '6. Roadmap', slug: 'roadmap' },
        { label: '7. Conclusion', slug: 'conclusion' },
        // --- Subnet Documentation (auto-generated from DeepWiki ingestion) ---
        {
          label: 'Subnet Documentation',
          autogenerate: { directory: 'subnets' },
        },
      ],
    }),
  ],
});
