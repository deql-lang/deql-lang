(function() {
  function getBasePath() {
    var meta = document.querySelector('meta[name="base-path"]');
    return meta ? meta.getAttribute('content') : '/';
  }

  function addDocsLink() {
    var socialIcons = document.querySelector('.social-icons');
    if (!socialIcons) return;
    var basePath = getBasePath();
    var link = document.createElement('a');
    link.href = basePath + 'overview/';
    link.textContent = 'Docs';
    link.style.cssText = 'color: var(--sl-color-white); text-decoration: none; font-size: 0.875rem; font-weight: 500; padding: 0.25rem 0.75rem; opacity: 0.85;';
    link.addEventListener('mouseenter', function() { link.style.opacity = '1'; });
    link.addEventListener('mouseleave', function() { link.style.opacity = '0.85'; });
    socialIcons.parentElement.insertBefore(link, socialIcons);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDocsLink);
  } else {
    addDocsLink();
  }
})();
