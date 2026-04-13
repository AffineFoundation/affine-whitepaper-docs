// Mermaid diagram expander functionality with zoom/pan
(function() {
  'use strict';

  // Modal HTML template with zoom controls
  const modalTemplate = `
    <div id="mermaid-modal" class="mermaid-modal">
      <div class="mermaid-modal-content">
        <div class="mermaid-modal-header">
          <div class="mermaid-modal-controls">
            <button class="mermaid-control-btn" id="zoom-in" aria-label="Zoom in">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="M11 8V14M8 11H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="mermaid-control-btn" id="zoom-out" aria-label="Zoom out">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="M8 11H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="mermaid-control-btn" id="zoom-reset" aria-label="Reset zoom">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M11 11L11 11.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
            </button>
            <span class="mermaid-zoom-level">100%</span>
          </div>
          <button class="mermaid-modal-close" aria-label="Close expanded diagram">&times;</button>
        </div>
        <div class="mermaid-modal-body">
          <div class="mermaid-diagram-container"></div>
        </div>
      </div>
    </div>
  `;

  const expandButtonTemplate = `
    <button class="mermaid-expand-btn" aria-label="Expand diagram">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 8V4H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 8V4H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 16V20H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 16V20H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;

  let modal = null;
  let isModalOpen = false;
  let currentZoom = 1;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let scrollLeft = 0;
  let scrollTop = 0;

  function initModal() {
    if (!modal) {
      const modalDiv = document.createElement('div');
      modalDiv.innerHTML = modalTemplate;
      document.body.appendChild(modalDiv.firstElementChild);
      modal = document.getElementById('mermaid-modal');

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      modal.querySelector('.mermaid-modal-close').addEventListener('click', closeModal);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isModalOpen) closeModal();
      });

      const zoomIn = modal.querySelector('#zoom-in');
      const zoomOut = modal.querySelector('#zoom-out');
      const zoomReset = modal.querySelector('#zoom-reset');

      zoomIn.addEventListener('click', () => adjustZoom(0.1));
      zoomOut.addEventListener('click', () => adjustZoom(-0.1));
      zoomReset.addEventListener('click', resetZoom);

      const modalBody = modal.querySelector('.mermaid-modal-body');
      const diagramContainer = modal.querySelector('.mermaid-diagram-container');

      diagramContainer.addEventListener('mousedown', startDragging);
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', stopDragging);

      diagramContainer.addEventListener('touchstart', (e) => startDragging(e.touches[0]));
      document.addEventListener('touchmove', (e) => drag(e.touches[0]));
      document.addEventListener('touchend', stopDragging);

      modalBody.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.05 : 0.05;
          adjustZoom(delta);
        }
      });
    }
  }

  function adjustZoom(delta) {
    currentZoom = Math.max(0.5, Math.min(3, currentZoom + delta));
    applyZoom();
  }

  function resetZoom() {
    currentZoom = 1;
    applyZoom();
    const modalBody = modal.querySelector('.mermaid-modal-body');
    modalBody.scrollLeft = 0;
    modalBody.scrollTop = 0;
  }

  function applyZoom() {
    const diagramContainer = modal.querySelector('.mermaid-diagram-container');
    diagramContainer.style.transform = `scale(${currentZoom})`;
    const zoomLevel = modal.querySelector('.mermaid-zoom-level');
    zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
  }

  function startDragging(e) {
    const diagramContainer = modal.querySelector('.mermaid-diagram-container');
    if (e.target.closest('.mermaid-diagram-container')) {
      isDragging = true;
      diagramContainer.style.cursor = 'grabbing';
      const modalBody = modal.querySelector('.mermaid-modal-body');
      startX = e.pageX || e.clientX;
      startY = e.pageY || e.clientY;
      scrollLeft = modalBody.scrollLeft;
      scrollTop = modalBody.scrollTop;
    }
  }

  function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const modalBody = modal.querySelector('.mermaid-modal-body');
    const x = (e.pageX || e.clientX) - startX;
    const y = (e.pageY || e.clientY) - startY;
    modalBody.scrollLeft = scrollLeft - x;
    modalBody.scrollTop = scrollTop - y;
  }

  function stopDragging() {
    isDragging = false;
    const diagramContainer = modal.querySelector('.mermaid-diagram-container');
    if (diagramContainer) diagramContainer.style.cursor = 'grab';
  }

  async function openModal(diagramElement) {
    if (!modal) initModal();

    const diagramContainer = modal.querySelector('.mermaid-diagram-container');
    let originalCode = diagramElement.getAttribute('data-original-mermaid-code');

    if (!originalCode) {
      console.error('[MermaidExpander] No original mermaid code found');
      return;
    }

    diagramContainer.innerHTML = '';
    resetZoom();

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    isModalOpen = true;

    const modalPre = document.createElement('pre');
    modalPre.className = 'mermaid mermaid-modal-diagram';
    modalPre.textContent = originalCode;
    modalPre.setAttribute('data-original-mermaid-code', originalCode);
    diagramContainer.appendChild(modalPre);

    if (window.mermaid && window.renderMermaidDiagrams) {
      await window.renderMermaidDiagrams();
    }

    const modalBody = modal.querySelector('.mermaid-modal-body');
    setTimeout(() => {
      const containerRect = modalBody.getBoundingClientRect();
      const diagramRect = diagramContainer.getBoundingClientRect();
      modalBody.scrollLeft = (diagramRect.width - containerRect.width) / 2;
      modalBody.scrollTop = (diagramRect.height - containerRect.height) / 2;
    }, 100);
  }

  function closeModal() {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      isModalOpen = false;
      const diagramContainer = modal.querySelector('.mermaid-diagram-container');
      diagramContainer.innerHTML = '';
    }
  }

  function addExpandButtons() {
    const mermaidDiagrams = document.querySelectorAll('pre.mermaid:not(.mermaid-modal-diagram)');

    mermaidDiagrams.forEach((diagram) => {
      if (diagram.closest('.mermaid-wrapper')?.querySelector('.mermaid-expand-btn')) return;

      let wrapper = diagram.parentElement;
      if (!wrapper || !wrapper.classList.contains('mermaid-wrapper')) {
        wrapper = document.createElement('div');
        wrapper.className = 'mermaid-wrapper';
        diagram.parentNode.insertBefore(wrapper, diagram);
        wrapper.appendChild(diagram);
      }

      const expandBtn = document.createElement('div');
      expandBtn.innerHTML = expandButtonTemplate;
      const button = expandBtn.firstElementChild;
      wrapper.appendChild(button);

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(diagram);
      });

      if (!diagram.classList.contains('mermaid-modal-diagram')) {
        diagram.style.cursor = 'pointer';
        diagram.addEventListener('click', (e) => {
          e.stopPropagation();
          openModal(diagram);
        });
      }
    });
  }

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

  const debouncedAddExpandButtons = debounce(addExpandButtons, 300);

  function initialize() {
    debouncedAddExpandButtons();

    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
          const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
          for (const node of nodes) {
            if (node.nodeType === 1 && (
              node.classList?.contains('mermaid') ||
              node.querySelector?.('.mermaid') ||
              node.querySelector?.('svg')
            )) {
              shouldUpdate = true;
              break;
            }
          }
        }
      }
      if (shouldUpdate) debouncedAddExpandButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  let renderCheckInterval = setInterval(() => {
    if (window.renderMermaidDiagrams) {
      clearInterval(renderCheckInterval);
      const originalRenderMermaid = window.renderMermaidDiagrams;
      window.renderMermaidDiagrams = async function(...args) {
        const result = await originalRenderMermaid.apply(this, args);
        setTimeout(() => debouncedAddExpandButtons(), 100);
        return result;
      };
    }
  }, 100);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  document.addEventListener('astro:page-load', () => initialize());
  document.addEventListener('astro:after-swap', () => debouncedAddExpandButtons());
})();
