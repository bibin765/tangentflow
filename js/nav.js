// TangentFlow — Shared Navigation & Footer
(function () {
  const page = document.body.dataset.page || ''
  const depth = parseInt(document.body.dataset.depth || '0')
  const prefix = '../'.repeat(depth)

  function activeClass(p) {
    return page === p ? ' active' : ''
  }

  // ── Navigation ──
  const navEl = document.getElementById('site-nav')
  if (navEl) {
    navEl.innerHTML = `
      <nav class="site-nav" role="navigation" aria-label="Main">
        <div class="nav-inner">
          <a href="${prefix}index.html" class="nav-logo">Tangent<span>Flow</span></a>
          <ul class="nav-links" id="nav-links">
            <li><a href="${prefix}index.html#features"${activeClass('features')}>Features</a></li>
            <li><a href="${prefix}pricing.html"${activeClass('pricing')}>Pricing</a></li>
            <li><a href="${prefix}docs.html"${activeClass('docs')}>Docs</a></li>
            <li><a href="${prefix}blog/index.html"${activeClass('blog')}>Blog</a></li>
            <li><a href="${prefix}about.html"${activeClass('about')}>About</a></li>
            <li class="nav-cta"><a href="${prefix}app.html" class="btn btn-primary btn-sm">Launch App</a></li>
          </ul>
          <button class="nav-hamburger" id="nav-hamburger" aria-label="Toggle menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </nav>
    `

    const hamburger = document.getElementById('nav-hamburger')
    const links = document.getElementById('nav-links')
    if (hamburger && links) {
      hamburger.addEventListener('click', () => {
        links.classList.toggle('open')
      })
    }
  }

  // ── Footer ──
  const footerEl = document.getElementById('site-footer')
  if (footerEl) {
    footerEl.innerHTML = `
      <footer class="site-footer">
        <div class="footer-inner">
          <span class="footer-text">TangentFlow &mdash; Pixel-perfect PDF generation, powered by Pretext.</span>
          <ul class="footer-links">
            <li><a href="https://github.com/chenglou/pretext" target="_blank" rel="noopener" aria-label="GitHub">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a></li>
            <li><a href="https://twitter.com" target="_blank" rel="noopener" aria-label="Twitter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a></li>
          </ul>
        </div>
      </footer>
    `
  }
})()
