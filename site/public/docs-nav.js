(function() {
  function getBasePath() {
    var meta = document.querySelector('meta[name="base-path"]');
    return meta ? meta.getAttribute('content') : '/';
  }

  function getVersionFromPath() {
    var basePath = getBasePath();
    var path = window.location.pathname.replace(basePath, '');
    var match = path.match(/^(v\d+-\d+-\d+)\//);
    return match ? match[1] : '';
  }

  function setSessionVersion(version) {
    if (version) {
      sessionStorage.setItem('deql-doc-version', version);
    } else {
      sessionStorage.removeItem('deql-doc-version');
    }
  }

  function getSessionVersion() {
    return sessionStorage.getItem('deql-doc-version') || '';
  }

  function getCurrentVersion() {
    // URL path takes precedence over session
    var pathVersion = getVersionFromPath();
    if (pathVersion) {
      setSessionVersion(pathVersion);
      return pathVersion;
    }
    return getSessionVersion();
  }

  function navigateToVersion(newVersion) {
    var basePath = getBasePath();
    var currentPath = window.location.pathname.replace(basePath, '');
    // Strip existing version prefix if present
    var stripped = currentPath.replace(/^v\d+-\d+-\d+\//, '');

    var newPath;
    if (newVersion) {
      newPath = basePath + newVersion + '/' + stripped;
      setSessionVersion(newVersion);
    } else {
      newPath = basePath + stripped;
      setSessionVersion('');
    }
    window.location.href = newPath;
  }

  function rewriteSidebarLinks(version) {
    if (!version) return;
    var basePath = getBasePath();
    var links = document.querySelectorAll('nav.sidebar-content a[href], starlight-menu-button + nav a[href]');
    // Also grab links in the main sidebar
    var sidebarNav = document.querySelector('[data-pagefind-ignore] nav') || document.querySelector('aside nav');
    var allLinks = document.querySelectorAll('aside a[href], .sidebar a[href], .sidebar-pane a[href]');

    allLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href) return;
      // Only rewrite internal docs links that don't already have a version prefix
      if (href.startsWith(basePath) && !href.match(new RegExp('^' + basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'v\\d+-\\d+-\\d+'))) {
        var relative = href.replace(basePath, '');
        link.setAttribute('href', basePath + version + '/' + relative);
      }
    });
  }

  function buildVersionDropdown(versions) {
    var basePath = getBasePath();
    var currentVersion = getCurrentVersion();

    var select = document.createElement('select');
    select.id = 'version-select';
    select.style.cssText = 'background: var(--sl-color-gray-6, #23262f); color: var(--sl-color-white, #fff); border: 1px solid var(--sl-color-gray-5, #343841); border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.8rem; cursor: pointer; margin-right: 0.5rem;';

    versions.forEach(function(v) {
      var option = document.createElement('option');
      option.value = v.value;
      option.textContent = v.label;
      if (v.value === currentVersion) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener('change', function() {
      navigateToVersion(this.value);
    });

    // Insert into header
    var socialIcons = document.querySelector('.social-icons');
    if (socialIcons && socialIcons.parentElement) {
      socialIcons.parentElement.insertBefore(select, socialIcons);
    }
  }

  function handleBannerClicks() {
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (target.tagName === 'A' && target.closest('.sl-banner')) {
        // "Switch to latest" link in the banner
        setSessionVersion('');
      }
    });
  }

  function observeSidebar(version) {
    if (!version) return;
    var sidebar = document.querySelector('aside') || document.querySelector('.sidebar');
    if (!sidebar) return;
    var observer = new MutationObserver(function() {
      rewriteSidebarLinks(version);
    });
    observer.observe(sidebar, { childList: true, subtree: true });
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

  function init() {
    addDocsLink();
    handleBannerClicks();

    var currentVersion = getCurrentVersion();

    // Fetch versions.json and build dropdown
    var basePath = getBasePath();
    fetch(basePath + 'versions.json')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.versions && data.versions.length > 1) {
          buildVersionDropdown(data.versions);
        }
      })
      .catch(function() {
        // versions.json not available — no dropdown
      });

    // Rewrite sidebar links if viewing a versioned page
    if (currentVersion) {
      rewriteSidebarLinks(currentVersion);
      observeSidebar(currentVersion);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
