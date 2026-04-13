async function loadMermaid() {
  if (window.mermaid) {
    return window.mermaid;
  }
  try {
    const mermaidModule = await import('https://cdn.jsdelivr.net/npm/mermaid@latest/dist/mermaid.esm.min.mjs');
    window.mermaid = mermaidModule.default;
    return window.mermaid;
  } catch (error) {
    console.error('[MermaidThemer] Failed to load Mermaid from CDN:', error);
    return null;
  }
}

async function renderMermaidDiagrams() {
  const mermaid = await loadMermaid();
  if (!mermaid) {
    console.error('[MermaidThemer] Mermaid library not available. Skipping rendering.');
    return;
  }

  // Dark-only Affine theme
  const themeConfig = {
    theme: 'base',
    themeVariables: {
      darkMode: true,
      background: '#1C1C1C',
      textColor: '#E5E5E5',
      lineColor: '#A1A1A1',
      primaryColor: '#2A2A2A',
      primaryTextColor: '#E5E5E5',
      primaryBorderColor: 'rgba(255, 255, 255, 0.12)',
      secondaryColor: '#242424',
      secondaryTextColor: '#E5E5E5',
      secondaryBorderColor: 'rgba(255, 255, 255, 0.08)',
      tertiaryColor: '#1F1F1F',
      tertiaryTextColor: '#E5E5E5',
      tertiaryBorderColor: 'rgba(255, 255, 255, 0.06)',
      actorBkg: '#2A2A2A',
      actorTextColor: '#E5E5E5',
      actorBorderColor: 'rgba(255, 255, 255, 0.12)',
      signalColor: '#E5E5E5',
      signalTextColor: '#E5E5E5',
      noteBkgColor: '#242424',
      noteTextColor: '#E5E5E5',
      noteBorderColor: 'rgba(255, 255, 255, 0.1)',
      defaultLinkColor: '#A1A1A1',
      edgeLabelBackground: '#1F1F1F',
      nodeTextColor: '#E5E5E5',
    }
  };

  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      ...themeConfig
    });

    const mermaidPres = document.querySelectorAll('pre.mermaid');

    for (let i = 0; i < mermaidPres.length; i++) {
      const preElement = mermaidPres[i];
      const id = `mermaid-client-${Date.now()}-${i}`;
      let originalCode = preElement.getAttribute('data-original-mermaid-code');

      if (!originalCode) {
        const codeElement = preElement.querySelector('code.language-mermaid');
        if (codeElement) {
          originalCode = codeElement.textContent || codeElement.innerText;
        } else {
          originalCode = preElement.textContent || preElement.innerText;
        }

        if (originalCode && originalCode.trim()) {
          preElement.setAttribute('data-original-mermaid-code', originalCode.trim());
        } else {
          continue;
        }
      }

      originalCode = preElement.getAttribute('data-original-mermaid-code');

      if (originalCode) {
        preElement.innerHTML = '';
        preElement.removeAttribute('data-processed');

        try {
          const { svg } = await mermaid.render(id, originalCode);
          preElement.innerHTML = svg;
        } catch (error) {
          console.error(`[MermaidThemer] Error rendering element #${i}:`, error);
          preElement.innerHTML = `<p style="color:#FF4747; font-family:'IBM Plex Mono',monospace; font-size:12px;">Error rendering diagram. Check console.</p>`;
        }
      }
    }
  } catch (error) {
    console.error('[MermaidThemer] Error during Mermaid init or rendering:', error);
  }
}

window.renderMermaidDiagrams = renderMermaidDiagrams;

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedRenderMermaidDiagrams = debounce(renderMermaidDiagrams, 100);

function initialRender() {
  debouncedRenderMermaidDiagrams();
}

document.addEventListener('DOMContentLoaded', initialRender);
document.addEventListener('astro:page-load', initialRender);
document.addEventListener('astro:after-swap', () => {
  debouncedRenderMermaidDiagrams();
});

if (document.readyState !== 'loading') {
  if (document.querySelector('pre.mermaid')) {
    Promise.resolve().then(initialRender);
  }
}
