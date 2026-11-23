/* ==========================================================================
   Tufte Monograph Engine: Unified Margin Layout & Theme Control
   ========================================================================== */

(function () {
  'use strict';

  const CONFIG = {
    mediaQuery: '(min-width: 1181px)',
    marginGap: 16 // Vertical gap between margin items and figures (px)
  };

  function getProseContainer() {
    return document.querySelector('.text-container') ||
           document.querySelector('main') ||
           document.querySelector('article') ||
           document.body;
  }

  // ------------------------------------------------------------------------
  // 1. Margin Track & Bi-Directional Collision Solver
  // ------------------------------------------------------------------------
  function resolveMarginTrack() {
    const isDesktop = window.matchMedia(CONFIG.mediaQuery).matches;
    const container = getProseContainer();
    if (!container) return;

    const marginItems = Array.from(document.querySelectorAll(
      '.sidenote, .marginnote, .entry-metadata, .entry-toc, ' +
      'div.epigraph.epigraph-margin > blockquote, figure.figure-margin'
    ));

    const obstacles = Array.from(document.querySelectorAll(
      'figure.figure-main-margin, figure.figure-full, ' +
      '.table-container.table-full, .entry-abbreviations, ' +
      '.entry-bibliography, .site-footer'
    ));

    marginItems.forEach(item => { item.style.transform = ''; });
    obstacles.forEach(obs => { obs.style.marginTop = ''; });

    if (!isDesktop) return;

    const containerRect = container.getBoundingClientRect();

    const items = marginItems.map((item, index) => {
      const rect = item.getBoundingClientRect();
      const naturalTop = rect.top - containerRect.top;
      return {
        el: item,
        index: index,
        height: rect.height,
        naturalTop: naturalTop,
        currentTop: naturalTop
      };
    });

    const obsList = obstacles.map(obs => {
      const rect = obs.getBoundingClientRect();
      return {
        top: rect.top - containerRect.top,
        bottom: rect.bottom - containerRect.top
      };
    }).sort((a, b) => a.top - b.top);

    // PASS 1: Upward Clearance for Figures & Upward Cascading
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];

      for (const obs of obsList) {
        const itemBottom = item.currentTop + item.height;

        if (item.currentTop < obs.bottom && itemBottom + CONFIG.marginGap > obs.top) {
          const overlap = (itemBottom + CONFIG.marginGap) - obs.top;

          if (overlap > 0) {
            item.currentTop -= overlap;

            let k = i;
            while (k > 0) {
              const curr = items[k];
              const prev = items[k - 1];

              if (curr.currentTop < prev.currentTop + prev.height + CONFIG.marginGap) {
                const prevShiftNeeded = (prev.currentTop + prev.height + CONFIG.marginGap) - curr.currentTop;
                prev.currentTop -= prevShiftNeeded;

                if (k - 1 === 0 && prev.currentTop < 0) {
                  const excess = -prev.currentTop;
                  for (let m = 0; m <= i; m++) {
                    items[m].currentTop += excess;
                  }
                  const obsPushDown = (items[i].currentTop + items[i].height + CONFIG.marginGap) - obs.top;
                  if (obsPushDown > 0) {
                    const currentMargin = parseFloat(getComputedStyle(obs.el).marginTop) || 0;
                    obs.el.style.marginTop = `${currentMargin + obsPushDown}px`;
                  }
                  break;
                }
              } else {
                break;
              }
              k--;
            }
          }
        }
      }
    }

    // PASS 2: Downward Stacking
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];

      const minAllowedTop = prev.currentTop + prev.height + CONFIG.marginGap;
      if (curr.currentTop < minAllowedTop) {
        curr.currentTop = minAllowedTop;
      }
    }

    // PASS 3: Apply GPU Transforms
    items.forEach(item => {
      const deltaY = item.currentTop - item.naturalTop;
      if (Math.abs(deltaY) >= 1) {
        item.el.style.transform = `translateY(${Math.round(deltaY)}px)`;
      }
    });
  }

  // Expose resolveMarginTrack globally so KaTeX's onload callback can trigger it
  window.resolveMarginTrack = resolveMarginTrack;

  // ------------------------------------------------------------------------
  // 2. Multi-Theme Selector Control
  // ------------------------------------------------------------------------
  function initThemeSwitcher() {
    const buttons = document.querySelectorAll('[data-set-theme]');
    if (!buttons.length) return;

    const currentTheme = localStorage.getItem('tufte-theme') || 'auto';

    function updateActiveState(activeTheme) {
      buttons.forEach(btn => {
        const isMatch = btn.getAttribute('data-set-theme') === activeTheme;
        btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      });
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-set-theme');
        if (theme === 'auto') {
          document.documentElement.removeAttribute('data-theme');
          localStorage.removeItem('tufte-theme');
        } else {
          document.documentElement.setAttribute('data-theme', theme);
          localStorage.setItem('tufte-theme', theme);
        }
        updateActiveState(theme);
      });
    });

    updateActiveState(currentTheme);
  }

  // ------------------------------------------------------------------------
  // 3. Lifecycle Controllers & Observers
  // ------------------------------------------------------------------------
  let resizeTimer;
  function debouncedLayout() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resolveMarginTrack, 20);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initThemeSwitcher();
    resolveMarginTrack();
  });

  window.addEventListener('load', resolveMarginTrack);
  window.addEventListener('resize', debouncedLayout);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(resolveMarginTrack);
  }

  document.querySelectorAll('img').forEach(img => {
    if (!img.complete) {
      img.addEventListener('load', resolveMarginTrack);
    }
  });
})();