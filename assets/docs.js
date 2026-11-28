/* ═══════════════════════════════════════════════
   Documentation Portal Engine
   Manifest-driven multi-page Markdown + Mermaid viewer
   Claude-inspired Editorial Dual-Mode (Ivory / Charcoal)
═══════════════════════════════════════════════ */

(function () {
  "use strict";

  const MERMAID_CDN_URL =
    "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js";
  const HEADING_SCROLL_OFFSET = 88;

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  // ── State ──
  let manifest = null;
  let flatPages = [];
  let currentRoute = "";
  let headingsData = [];
  let currentActiveHeadingId = "";
  let activeScrollTarget = null;
  let lockedTocHeadingId = "";
  let skipNextNavCenter = false;
  let hashSyncTimer = null;
  let pendingHashTarget = "";
  let currentMermaidEntries = [];
  let mermaidLoadPromise = null;
  let mermaidInitializedTheme = "";
  let mermaidRenderToken = 0;
  let mermaidObserver = null;
  let mermaidQueue = Promise.resolve();
  let currentTheme =
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  let isTocHovered = false;
  let lightboxZoom = 1;
  let searchResults = [];
  let searchSelectedIndex = -1;

  // ── DOM References ──
  const navSidebar = document.getElementById("navSidebar");
  const navTree = document.getElementById("navTree");

  const searchModal = document.getElementById("searchModal");
  const searchModalInput = document.getElementById("searchModalInput");
  const searchModalClearBtn = document.getElementById("searchModalClearBtn");
  const searchModalResults = document.getElementById("searchModalResults");

  const tocSidebar = document.getElementById("tocSidebar");
  const tocScrollArea = document.getElementById("tocScrollArea");
  const tocListWrap = document.getElementById("tocListWrap");
  const tocActiveIndicator = document.getElementById("tocActiveIndicator");
  const tocList = document.getElementById("tocList");

  const markdownContent = document.getElementById("markdownContent");

  const loadingOverlay = document.getElementById("loadingOverlay");
  const errorContainer = document.getElementById("errorContainer");
  const errorTitle = document.getElementById("errorTitle");
  const errorMsg = document.getElementById("errorMsg");
  const errorTip = document.getElementById("errorTip");

  const brandHomeLink = document.getElementById("brandHomeLink");
  const mobileNavBtn = document.getElementById("mobileNavBtn");
  const mobileTocBtn = document.getElementById("mobileTocBtn");
  const searchTriggerBtn = document.getElementById("searchTriggerBtn");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const themeToggleIcon = document.getElementById("themeToggleIcon");
  const drawerOverlay = document.getElementById("drawerOverlay");

  const diagramLightbox = document.getElementById("diagramLightbox");
  const diagramLightboxTitle = document.getElementById("diagramLightboxTitle");
  const diagramLightboxCanvas = document.getElementById("diagramLightboxCanvas");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomResetBtn = document.getElementById("zoomResetBtn");
  const zoomLevelText = document.getElementById("zoomLevelText");
  const closeLightboxBtn = document.getElementById("closeLightboxBtn");

  // ── Library Configuration ──
  if (window.marked) {
    marked.setOptions({
      gfm: true,
      breaks: false
    });
  }

  function getMermaidThemeVariables(theme) {
    if (theme === "dark") {
      return {
        darkMode: true,
        background: "#1f1f1d",
        primaryColor: "#2e2e2b",
        primaryTextColor: "#faf9f5",
        primaryBorderColor: "#4a4a46",
        lineColor: "#bf6542",
        secondaryColor: "#262624",
        tertiaryColor: "#1f1f1d",
        mainBkg: "#2e2e2b",
        nodeBorder: "#4a4a46",
        clusterBkg: "rgba(250, 249, 245, 0.04)",
        clusterBorder: "#3d3d3a",
        edgeLabelBackground: "#262624",
        actorBkg: "#2e2e2b",
        actorBorder: "#bf6542",
        actorTextColor: "#faf9f5",
        actorLineColor: "#52524e",
        signalColor: "#df825d",
        signalTextColor: "#faf9f5",
        noteBkgColor: "#2e2e2b",
        noteBorderColor: "#bf6542",
        noteTextColor: "#f5f4f0",
        attributeBackgroundColorOdd: "#262624",
        attributeBackgroundColorEven: "#2e2e2b",
        fontFamily: "Figtree, system-ui, -apple-system, sans-serif",
        fontSize: "13px"
      };
    }

    return {
      darkMode: false,
      background: "#f4f3ee",
      primaryColor: "#faf9f5",
      primaryTextColor: "#141413",
      primaryBorderColor: "#d4d1c5",
      lineColor: "#bf6542",
      secondaryColor: "#f0eee6",
      tertiaryColor: "#f4f3ee",
      mainBkg: "#faf9f5",
      nodeBorder: "#d4d1c5",
      clusterBkg: "rgba(20, 20, 19, 0.028)",
      clusterBorder: "#d4d1c5",
      edgeLabelBackground: "#f4f3ee",
      actorBkg: "#faf9f5",
      actorBorder: "#bf6542",
      actorTextColor: "#141413",
      actorLineColor: "#a3a096",
      signalColor: "#bf6542",
      signalTextColor: "#141413",
      noteBkgColor: "#f0eee6",
      noteBorderColor: "#d4d1c5",
      noteTextColor: "#3d3d3a",
      attributeBackgroundColorOdd: "#faf9f5",
      attributeBackgroundColorEven: "#f0eee6",
      fontFamily: "Figtree, system-ui, -apple-system, sans-serif",
      fontSize: "13px"
    };
  }

  function ensureMermaidLoaded() {
    if (window.mermaid) return Promise.resolve(true);
    if (mermaidLoadPromise) return mermaidLoadPromise;

    mermaidLoadPromise = new Promise(function (resolve) {
      const script = document.createElement("script");
      script.src = MERMAID_CDN_URL;
      script.async = true;
      script.onload = function () {
        resolve(Boolean(window.mermaid));
      };
      script.onerror = function () {
        mermaidLoadPromise = null;
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return mermaidLoadPromise;
  }

  function initMermaid(theme) {
    if (!window.mermaid || mermaidInitializedTheme === theme) return;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis"
      },
      sequence: {
        useMaxWidth: true,
        mirrorActors: false
      },
      er: {
        useMaxWidth: true
      },
      themeVariables: getMermaidThemeVariables(theme)
    });
    mermaidInitializedTheme = theme;
  }

  function applyTheme(theme, rerenderDiagrams) {
    currentTheme = theme === "dark" ? "dark" : "light";
    const root = document.documentElement;

    // Disable transitions for 1 frame so mobile GPUs repaint instantly without jank
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", currentTheme);

    if (themeToggleIcon && themeToggleBtn) {
      if (currentTheme === "dark") {
        themeToggleIcon.className = "fas fa-sun";
        themeToggleBtn.title = "Switch to Light mode";
      } else {
        themeToggleIcon.className = "fas fa-moon";
        themeToggleBtn.title = "Switch to Dark mode";
      }
    }

    void root.offsetHeight;
    requestAnimationFrame(function () {
      root.classList.remove("theme-switching");
    });

    try {
      localStorage.setItem("docs_theme", currentTheme);
    } catch (e) {
      /* ignore storage errors */
    }

    if (rerenderDiagrams && currentMermaidEntries.length > 0) {
      mermaidRenderToken++;
      const activeToken = mermaidRenderToken;
      const targetTheme = currentTheme;

      // Instant swap for any diagram already cached in targetTheme
      currentMermaidEntries.forEach(function (entry) {
        if (entry.svgCache[targetTheme]) {
          applyCachedMermaidSvg(entry, targetTheme);
        }
      });

      // Defer uncached visible diagrams until after the theme has painted
      requestAnimationFrame(function () {
        setTimeout(function () {
          if (activeToken !== mermaidRenderToken) return;
          scheduleMermaidDiagrams(currentMermaidEntries, activeToken, targetTheme);
        }, 0);
      });
    }
  }

  // ── Utilities ──
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  function showLoading(show) {
    loadingOverlay.classList.toggle("hidden", !show);
  }

  function showError(title, message, tipHtml) {
    errorTitle.textContent = title;
    errorMsg.textContent = message;
    if (tipHtml) {
      errorTip.innerHTML = tipHtml;
      errorTip.style.display = "block";
    } else {
      errorTip.style.display = "none";
    }
    errorContainer.style.display = "block";
  }

  function hideError() {
    errorContainer.style.display = "none";
  }

  function buildFileCorsTip() {
    if (window.location.protocol === "file:") {
      return (
        'Browsers block <code>fetch()</code> requests over <code>file://</code>. ' +
        "Start a local HTTP server from the repository root (for example " +
        "<code>python -m http.server 8000</code> or VS Code Live Server) and open " +
        "<code>http://localhost:8000/</code>."
      );
    }
    return "";
  }

  // ── Drawer & Modal Controls ──
  function closeAllDrawers() {
    navSidebar.classList.remove("open");
    tocSidebar.classList.remove("open");
    drawerOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  function toggleNavDrawer() {
    const willOpen = !navSidebar.classList.contains("open");
    closeAllDrawers();
    if (willOpen) {
      navSidebar.classList.add("open");
      drawerOverlay.classList.add("open");
      document.body.style.overflow = "hidden";
      requestAnimationFrame(function () {
        centerActiveNavLink(false);
      });
    }
  }

  function toggleTocDrawer() {
    const willOpen = !tocSidebar.classList.contains("open");
    closeAllDrawers();
    if (willOpen) {
      tocSidebar.classList.add("open");
      drawerOverlay.classList.add("open");
      document.body.style.overflow = "hidden";
      requestAnimationFrame(function () {
        updateTocScrollFades();
        updateTocIndicator(false);
      });
    }
  }

  function getSvgNaturalWidth(svgElement) {
    if (svgElement.viewBox && svgElement.viewBox.baseVal && svgElement.viewBox.baseVal.width > 0) {
      return Math.ceil(svgElement.viewBox.baseVal.width);
    }
    const vbAttr = svgElement.getAttribute("viewBox");
    if (vbAttr) {
      const parts = vbAttr.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0) return Math.ceil(parts[2]);
    }
    const rect = svgElement.getBoundingClientRect();
    return rect.width > 0 ? Math.ceil(rect.width) : 800;
  }

  function openLightbox(title, svgElement) {
    diagramLightboxTitle.textContent = title || "Diagram Preview";
    diagramLightboxCanvas.innerHTML = "";
    const clone = svgElement.cloneNode(true);
    const naturalW = getSvgNaturalWidth(svgElement);
    const targetW = Math.max(Math.min(naturalW, 1800), 820);
    clone.removeAttribute("style");
    clone.removeAttribute("height");
    clone.setAttribute("width", String(targetW));
    clone.style.width = targetW + "px";
    clone.style.maxWidth = "none";
    clone.style.height = "auto";
    clone.style.display = "block";
    diagramLightboxCanvas.appendChild(clone);
    lightboxZoom = 1;
    applyLightboxZoom();
    diagramLightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    diagramLightbox.classList.remove("open");
    diagramLightboxCanvas.innerHTML = "";
    document.body.style.overflow = "";
  }

  function applyLightboxZoom() {
    diagramLightboxCanvas.style.transform = "scale(" + lightboxZoom + ")";
    zoomLevelText.textContent = Math.round(lightboxZoom * 100) + "%";
  }

  // ── Routing Helpers ──
  function parseHash() {
    const raw = (window.location.hash || "").replace(/^#/, "").trim();
    if (!raw) {
      return { route: manifest ? manifest.defaultPage : "", heading: "" };
    }
    const atIndex = raw.indexOf("@");
    if (atIndex !== -1) {
      return {
        route: raw.slice(0, atIndex),
        heading: decodeURIComponent(raw.slice(atIndex + 1))
      };
    }
    return { route: raw, heading: "" };
  }

  function findPageByRoute(route) {
    return flatPages.find(function (p) {
      return p.route === route;
    });
  }

  function resolveRelativePath(baseFile, relHref) {
    const baseParts = baseFile.split("/");
    baseParts.pop();
    const relParts = relHref.split("/");
    relParts.forEach(function (part) {
      if (!part || part === ".") return;
      if (part === "..") {
        baseParts.pop();
      } else {
        baseParts.push(part);
      }
    });
    return baseParts.join("/");
  }

  // ── Navigation Tree ──
  function renderNavTree() {
    navTree.innerHTML = "";

    manifest.groups.forEach(function (group) {
      if (!group.pages || group.pages.length === 0) return;

      const groupEl = document.createElement("div");
      groupEl.className = "nav-group";
      groupEl.dataset.groupId = group.id;

      const headerBtn = document.createElement("button");
      headerBtn.type = "button";
      headerBtn.className = "nav-group-header";
      headerBtn.innerHTML =
        '<span class="nav-group-title">' +
        escapeHtml(group.title) +
        "</span>" +
        '<i class="fas fa-chevron-down nav-group-chevron"></i>';

      headerBtn.addEventListener("click", function () {
        groupEl.classList.toggle("collapsed");
      });

      const listEl = document.createElement("ul");
      listEl.className = "nav-group-pages";

      group.pages.forEach(function (page) {
        const route = group.id + "/" + page.id;
        const li = document.createElement("li");
        li.className = "nav-page-item";

        const a = document.createElement("a");
        a.href = "#" + route;
        a.className = "nav-page-link" + (route === currentRoute ? " active" : "");
        a.dataset.route = route;
        a.title = page.summary || page.title;
        a.textContent = page.title;

        a.addEventListener("click", function () {
          skipNextNavCenter = true;
          if (window.innerWidth < 1024) {
            closeAllDrawers();
          }
        });

        li.appendChild(a);
        listEl.appendChild(li);
      });

      groupEl.appendChild(headerBtn);
      groupEl.appendChild(listEl);
      navTree.appendChild(groupEl);
    });
  }

  // ── Search Modal (Ctrl+K) ──
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightSearchMatches(text, tokens) {
    let html = escapeHtml(text);
    if (!tokens.length) return html;
    const pattern = new RegExp(
      "(" + tokens.map(escapeRegex).join("|") + ")",
      "gi"
    );
    return html.replace(pattern, '<mark class="search-highlight">$1</mark>');
  }

  function openSearchModal() {
    if (!searchModal || !manifest) return;
    closeAllDrawers();
    searchModal.classList.add("open");
    document.body.style.overflow = "hidden";
    renderSearchResults(searchModalInput.value);
    setTimeout(function () {
      searchModalInput.focus();
      searchModalInput.select();
    }, 20);
  }

  function closeSearchModal() {
    if (!searchModal || !searchModal.classList.contains("open")) return;
    searchModal.classList.remove("open");
    if (!diagramLightbox.classList.contains("open")) {
      document.body.style.overflow = "";
    }
  }

  function updateSearchSelection(index) {
    const items = searchModalResults.querySelectorAll(".search-result-item");
    if (!items.length) {
      searchSelectedIndex = -1;
      return;
    }
    searchSelectedIndex = (index + items.length) % items.length;
    items.forEach(function (el, i) {
      const isSelected = i === searchSelectedIndex;
      el.classList.toggle("selected", isSelected);
      el.setAttribute("aria-selected", isSelected ? "true" : "false");
      if (isSelected) {
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function selectSearchResult(page) {
    if (!page) return;
    closeSearchModal();
    if (window.location.hash === "#" + page.route) {
      loadPage(page.route, "");
    } else {
      window.location.hash = "#" + page.route;
    }
  }

  function renderSearchResults(rawQuery) {
    const query = (rawQuery || "").trim();
    const tokens = query
      ? query.toLowerCase().split(/\s+/).filter(Boolean)
      : [];

    searchModalClearBtn.style.display = query ? "inline-flex" : "none";

    searchResults = flatPages.filter(function (page) {
      if (!tokens.length) return true;
      const haystack = (
        page.groupTitle +
        " " +
        page.title +
        " " +
        page.summary
      ).toLowerCase();
      return tokens.every(function (tok) {
        return haystack.includes(tok);
      });
    });

    searchModalResults.innerHTML = "";

    if (searchResults.length === 0) {
      searchSelectedIndex = -1;
      const empty = document.createElement("div");
      empty.className = "search-modal-empty";
      empty.textContent = 'No pages match "' + query + '".';
      searchModalResults.appendChild(empty);
      return;
    }

    searchResults.forEach(function (page, idx) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-result-item" + (idx === 0 ? " selected" : "");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", idx === 0 ? "true" : "false");

      btn.innerHTML =
        '<div class="search-result-top">' +
        '<span class="search-result-title">' +
        highlightSearchMatches(page.title, tokens) +
        "</span>" +
        '<span class="search-result-group">' +
        highlightSearchMatches(page.groupTitle, tokens) +
        "</span>" +
        "</div>" +
        (page.summary
          ? '<div class="search-result-summary">' +
            highlightSearchMatches(page.summary, tokens) +
            "</div>"
          : "");

      btn.addEventListener("mouseenter", function () {
        updateSearchSelection(idx);
      });
      btn.addEventListener("click", function () {
        selectSearchResult(page);
      });

      searchModalResults.appendChild(btn);
    });

    searchSelectedIndex = 0;
  }

  function updateActiveNavLink() {
    navTree.querySelectorAll(".nav-page-link").forEach(function (link) {
      link.classList.toggle("active", link.dataset.route === currentRoute);
    });
  }

  function centerActiveNavLink(smooth) {
    if (!navTree) return;
    const activeLink = navTree.querySelector(".nav-page-link.active");
    if (!activeLink) return;

    const groupEl = activeLink.closest(".nav-group");
    if (groupEl && groupEl.classList.contains("collapsed")) {
      groupEl.classList.remove("collapsed");
    }

    const treeRect = navTree.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    if (!treeRect.height || !linkRect.height) return;

    const currentCenterOffset = linkRect.top - treeRect.top + linkRect.height / 2;
    const targetScrollTop =
      navTree.scrollTop + currentCenterOffset - treeRect.height / 2;
    const maxScroll = Math.max(0, navTree.scrollHeight - navTree.clientHeight);
    const clampedTop = Math.max(0, Math.min(maxScroll, Math.round(targetScrollTop)));

    navTree.scrollTo({
      top: clampedTop,
      behavior: smooth ? "smooth" : "instant"
    });
  }

  // ── Document Rendering Pipeline ──
  async function loadPage(route, targetHeadingId, isInitialLoad) {
    const pageEntry = findPageByRoute(route) || flatPages[0];
    if (!pageEntry) {
      showError("No documents registered", "docs-manifest.json contains no pages.");
      showLoading(false);
      return;
    }

    currentRoute = pageEntry.route;
    currentActiveHeadingId = "";
    activeScrollTarget = null;
    lockedTocHeadingId = "";
    cancelPendingHashSync();
    disconnectMermaidObserver();
    mermaidRenderToken++;
    currentMermaidEntries = [];
    hideError();
    showLoading(true);
    updateActiveNavLink();
    if (!skipNextNavCenter) {
      centerActiveNavLink(!isInitialLoad);
    }
    skipNextNavCenter = false;

    try {
      const res = await fetch(pageEntry.file, { cache: "no-cache" });
      if (!res.ok) {
        throw new Error("HTTP " + res.status + " while fetching " + pageEntry.file);
      }

      const mdText = await res.text();

      markdownContent.innerHTML = marked.parse(mdText);

      transformCallouts();
      wrapResponsiveTables();
      rewriteInternalLinks(pageEntry);
      currentMermaidEntries = extractMermaidBlocks();
      highlightAndWrapCodeBlocks();
      enhanceColorSwatches();
      buildTocAndAnchors();

      document.title =
        pageEntry.title + " — " + pageEntry.groupTitle + " | " + (manifest.siteTitle || "Docs");

      if (targetHeadingId && document.getElementById(targetHeadingId)) {
        await scrollToHeading(targetHeadingId, false, true);
        if (currentMermaidEntries.length > 0) {
          scheduleMermaidDiagrams(currentMermaidEntries, mermaidRenderToken, currentTheme);
        }
        showLoading(false);
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
        scrollSpy();
        showLoading(false);
        if (currentMermaidEntries.length > 0) {
          scheduleMermaidDiagrams(currentMermaidEntries, mermaidRenderToken, currentTheme);
        }
      }
    } catch (err) {
      console.error("Failed to load documentation page:", err);
      markdownContent.innerHTML = "";
      tocList.innerHTML = "";
      hideTocIndicator();
      showError(
        "Failed to load document",
        'Could not load "' + pageEntry.file + '". ' + err.message,
        buildFileCorsTip()
      );
      showLoading(false);
    }
  }

  // Transform GitHub-style alert blockquotes (> [!NOTE], > [!TIP], etc.)
  function transformCallouts() {
    const calloutMeta = {
      NOTE: { cls: "note", icon: "fa-circle-info", label: "Note" },
      TIP: { cls: "tip", icon: "fa-lightbulb", label: "Tip" },
      IMPORTANT: { cls: "important", icon: "fa-circle-exclamation", label: "Important" },
      WARNING: { cls: "warning", icon: "fa-triangle-exclamation", label: "Warning" },
      CAUTION: { cls: "caution", icon: "fa-shield-halved", label: "Caution" }
    };

    markdownContent.querySelectorAll("blockquote").forEach(function (bq) {
      const firstP = bq.querySelector("p");
      if (!firstP) return;

      const match = firstP.innerHTML.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br\s*\/?>|\n)?/i);
      if (!match) return;

      const typeKey = match[1].toUpperCase();
      const meta = calloutMeta[typeKey];
      firstP.innerHTML = firstP.innerHTML.slice(match[0].length).trim();
      if (!firstP.innerHTML) {
        firstP.remove();
      }

      const box = document.createElement("div");
      box.className = "callout callout-" + meta.cls;

      const titleEl = document.createElement("div");
      titleEl.className = "callout-title";
      titleEl.innerHTML = '<i class="fas ' + meta.icon + '"></i><span>' + meta.label + "</span>";

      const bodyEl = document.createElement("div");
      bodyEl.className = "callout-body";
      while (bq.firstChild) {
        bodyEl.appendChild(bq.firstChild);
      }

      box.appendChild(titleEl);
      box.appendChild(bodyEl);
      bq.parentNode.replaceChild(box, bq);
    });
  }

  function wrapResponsiveTables() {
    markdownContent.querySelectorAll("table").forEach(function (table) {
      if (table.parentElement.classList.contains("table-scroll")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "table-scroll";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function rewriteInternalLinks(pageEntry) {
    markdownContent.querySelectorAll("a[href]").forEach(function (a) {
      const href = a.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        return;
      }

      if (href.startsWith("#")) {
        const headingId = href.slice(1);
        a.href = "#" + pageEntry.route + "@" + encodeURIComponent(headingId);
        a.addEventListener("click", function (e) {
          e.preventDefault();
          scrollToHeading(headingId, true);
        });
        return;
      }

      const mdMatch = href.match(/^([^#?]+\.md)(?:#(.+))?$/i);
      if (mdMatch) {
        const resolved = resolveRelativePath(pageEntry.file, mdMatch[1]);
        const targetPage = flatPages.find(function (p) {
          return p.file.toLowerCase() === resolved.toLowerCase();
        });
        if (targetPage) {
          const hashTarget =
            "#" +
            targetPage.route +
            (mdMatch[2] ? "@" + encodeURIComponent(mdMatch[2]) : "");
          a.setAttribute("href", hashTarget);
        }
      }
    });

    markdownContent.querySelectorAll("img[src]").forEach(function (img) {
      const src = img.getAttribute("src") || "";
      if (!src || /^(https?:|data:|\/)/i.test(src)) return;
      img.setAttribute("src", resolveRelativePath(pageEntry.file, src));
      if (!img.getAttribute("loading")) {
        img.setAttribute("loading", "lazy");
      }
    });
  }

  // Extract ```mermaid blocks before syntax highlighting
  function extractMermaidBlocks() {
    const entries = [];
    const blocks = markdownContent.querySelectorAll(
      "pre > code.language-mermaid, pre > code.lang-mermaid"
    );

    blocks.forEach(function (codeEl, idx) {
      const pre = codeEl.parentElement;
      const source = codeEl.textContent.trim();

      let label = "Architecture Diagram #" + (idx + 1);
      let prev = pre.previousElementSibling;
      while (prev) {
        if (/^H[2-4]$/.test(prev.tagName)) {
          label = prev.textContent.replace(/#$/, "").trim();
          break;
        }
        prev = prev.previousElementSibling;
      }

      const card = document.createElement("div");
      card.className = "mermaid-card";

      const header = document.createElement("div");
      header.className = "mermaid-card-header";
      header.innerHTML =
        '<span class="mermaid-card-label"><i class="fas fa-diagram-project"></i> ' +
        escapeHtml(label) +
        "</span>" +
        '<div class="mermaid-card-actions">' +
        '<button type="button" class="copy-code-btn mermaid-copy-btn" title="Copy Mermaid source">' +
        '<i class="far fa-copy"></i> <span>Source</span></button>' +
        '<button type="button" class="copy-code-btn mermaid-expand-btn" title="Expand diagram">' +
        '<i class="fas fa-expand"></i> <span>Expand</span></button>' +
        "</div>";

      const canvas = document.createElement("div");
      canvas.className = "mermaid-canvas";
      canvas.innerHTML = '<div class="mermaid-loading">Loading diagram...</div>';

      card.appendChild(header);
      card.appendChild(canvas);
      pre.parentNode.replaceChild(card, pre);

      const entry = {
        card: card,
        canvas: canvas,
        source: source,
        label: label,
        svgCache: {},
        renderedTheme: ""
      };

      const copyBtn = header.querySelector(".mermaid-copy-btn");
      copyBtn.addEventListener("click", function () {
        copyTextToClipboard(source, copyBtn, '<i class="far fa-copy"></i> <span>Source</span>');
      });

      const expandBtn = header.querySelector(".mermaid-expand-btn");
      expandBtn.addEventListener("click", async function () {
        if (entry.renderedTheme !== currentTheme || !canvas.querySelector("svg")) {
          await queueMermaidEntryRender(entry, mermaidRenderToken, currentTheme);
        }
        const svg = canvas.querySelector("svg");
        if (svg) {
          openLightbox(label, svg);
        }
      });

      entries.push(entry);
    });

    return entries;
  }

  function disconnectMermaidObserver() {
    if (mermaidObserver) {
      mermaidObserver.disconnect();
      mermaidObserver = null;
    }
  }

  function styleMermaidSvg(svg) {
    const naturalW = getSvgNaturalWidth(svg);
    const minReadableW = Math.min(naturalW, 640);
    svg.removeAttribute("height");
    svg.setAttribute("width", "100%");
    svg.style.width = "100%";
    svg.style.maxWidth = Math.max(naturalW, 680) + "px";
    svg.style.minWidth = minReadableW + "px";
    svg.style.height = "auto";
  }

  function applyCachedMermaidSvg(entry, theme) {
    const cachedHtml = entry.svgCache[theme];
    if (!cachedHtml) return false;
    entry.canvas.innerHTML = cachedHtml;
    entry.renderedTheme = theme;
    return true;
  }

  function isElementNearViewport(el, marginPx) {
    const rect = el.getBoundingClientRect();
    const viewH = window.innerHeight || document.documentElement.clientHeight || 800;
    return rect.bottom >= -marginPx && rect.top <= viewH + marginPx;
  }

  function queueMermaidEntryRender(entry, token, theme) {
    if (entry.renderedTheme === theme && entry.canvas.querySelector("svg")) {
      return Promise.resolve();
    }
    if (applyCachedMermaidSvg(entry, theme)) {
      return Promise.resolve();
    }

    mermaidQueue = mermaidQueue.then(async function () {
      if (token !== mermaidRenderToken) return;
      if (entry.renderedTheme === theme && entry.canvas.querySelector("svg")) return;
      if (applyCachedMermaidSvg(entry, theme)) return;

      const loaded = await ensureMermaidLoaded();
      if (token !== mermaidRenderToken) return;
      if (!loaded) {
        entry.canvas.innerHTML =
          '<div class="mermaid-error">Mermaid library failed to load from CDN.\n\n' +
          escapeHtml(entry.source) +
          "</div>";
        return;
      }

      try {
        initMermaid(theme);
        const freshDiv = document.createElement("div");
        freshDiv.className = "mermaid";
        freshDiv.textContent = entry.source;
        entry.canvas.innerHTML = "";
        entry.canvas.appendChild(freshDiv);

        await mermaid.run({ nodes: [freshDiv] });
        if (token !== mermaidRenderToken) return;

        const svg = freshDiv.querySelector("svg");
        if (svg) {
          styleMermaidSvg(svg);
          entry.svgCache[theme] = entry.canvas.innerHTML;
          entry.renderedTheme = theme;
          if (activeScrollTarget && activeScrollTarget.token === token) {
            alignWindowToHeading(activeScrollTarget.id, false);
          } else {
            scrollSpy();
          }
        }
      } catch (err) {
        if (token !== mermaidRenderToken) return;
        console.error("Mermaid render error:", err);
        entry.canvas.innerHTML =
          '<div class="mermaid-error">Diagram rendering error: ' +
          escapeHtml(err.message || String(err)) +
          "\n\n" +
          escapeHtml(entry.source) +
          "</div>";
      }

      // Yield briefly to keep mobile scrolling and taps responsive between diagrams
      await new Promise(function (r) {
        setTimeout(r, 0);
      });
    });

    return mermaidQueue;
  }

  function scheduleMermaidDiagrams(mermaidEntries, token, theme) {
    disconnectMermaidObserver();
    if (!mermaidEntries.length) return;

    const pendingEntries = mermaidEntries.filter(function (entry) {
      if (entry.renderedTheme === theme && entry.canvas.querySelector("svg")) return false;
      if (applyCachedMermaidSvg(entry, theme)) return false;
      return true;
    });

    if (!pendingEntries.length) return;

    if (!("IntersectionObserver" in window)) {
      pendingEntries.forEach(function (entry) {
        queueMermaidEntryRender(entry, token, theme);
      });
      return;
    }

    const entryMap = new WeakMap();
    mermaidObserver = new IntersectionObserver(
      function (items) {
        items.forEach(function (item) {
          if (!item.isIntersecting) return;
          const entry = entryMap.get(item.target);
          if (!entry) return;
          if (mermaidObserver) mermaidObserver.unobserve(item.target);
          queueMermaidEntryRender(entry, token, theme);
        });
      },
      { rootMargin: "320px 0px" }
    );

    pendingEntries.forEach(function (entry) {
      if (isElementNearViewport(entry.card, 320)) {
        queueMermaidEntryRender(entry, token, theme);
      } else {
        entryMap.set(entry.card, entry);
        mermaidObserver.observe(entry.card);
      }
    });
  }

  function highlightAndWrapCodeBlocks() {
    markdownContent.querySelectorAll("pre").forEach(function (pre) {
      if (pre.parentElement.classList.contains("code-block-container")) return;

      const codeEl = pre.querySelector("code");
      let langLabel = "Code";

      if (codeEl) {
        const langClass = Array.from(codeEl.classList).find(function (c) {
          return c.startsWith("language-");
        });
        if (langClass) {
          const rawLang = langClass.replace("language-", "");
          const friendlyNames = {
            sql: "T-SQL / SQL",
            cs: "C#",
            csharp: "C#",
            js: "JavaScript",
            json: "JSON",
            html: "HTML",
            css: "CSS",
            text: "Plain Text",
            bash: "Shell"
          };
          langLabel = friendlyNames[rawLang.toLowerCase()] || rawLang.toUpperCase();
        }

        if (window.hljs) {
          hljs.highlightElement(codeEl);
        }
      }

      const container = document.createElement("div");
      container.className = "code-block-container";

      const header = document.createElement("div");
      header.className = "code-block-header";
      header.innerHTML =
        '<span class="code-block-lang"><i class="fas fa-terminal"></i> ' +
        escapeHtml(langLabel) +
        "</span>" +
        '<button type="button" class="copy-code-btn" aria-label="Copy code">' +
        '<i class="far fa-copy"></i> <span>Copy</span></button>';

      pre.parentNode.insertBefore(container, pre);
      container.appendChild(header);
      container.appendChild(pre);

      const copyBtn = header.querySelector(".copy-code-btn");
      copyBtn.addEventListener("click", function () {
        const text = codeEl ? codeEl.textContent : pre.textContent;
        copyTextToClipboard(text, copyBtn, '<i class="far fa-copy"></i> <span>Copy</span>');
      });
    });
  }

  const COLOR_VALUE_PATTERN =
    "(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?)\\(\\s*[^()]+\\s*\\))";
  const PURE_COLOR_RE = new RegExp("^" + COLOR_VALUE_PATTERN + "$");
  const CSS_VAR_COLOR_RE = new RegExp(
    "^(--[a-zA-Z0-9_-]+:\\s*)(" + COLOR_VALUE_PATTERN + ")$"
  );

  function isValidCssColor(value) {
    if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
      return CSS.supports("color", value);
    }
    const s = new Option().style;
    s.color = "";
    s.color = value;
    return s.color !== "";
  }

  function createColorSwatch(colorValue) {
    const swatch = document.createElement("span");
    swatch.className = "color-swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatch.style.setProperty("--swatch-color", colorValue);
    return swatch;
  }

  function enhanceColorSwatches() {
    markdownContent.querySelectorAll("code").forEach(function (codeEl) {
      if (codeEl.closest("pre") || codeEl.querySelector(".color-swatch")) return;

      const rawText = codeEl.textContent.trim();
      if (!rawText) return;

      if (PURE_COLOR_RE.test(rawText) && isValidCssColor(rawText)) {
        codeEl.classList.add("code-color-chip");
        codeEl.title = "Color: " + rawText;
        codeEl.prepend(createColorSwatch(rawText));
        return;
      }

      const cssVarMatch = rawText.match(CSS_VAR_COLOR_RE);
      if (cssVarMatch && isValidCssColor(cssVarMatch[2])) {
        codeEl.classList.add("code-color-chip");
        codeEl.title = "Color: " + cssVarMatch[2];
        codeEl.textContent = "";
        codeEl.appendChild(document.createTextNode(cssVarMatch[1]));
        codeEl.appendChild(createColorSwatch(cssVarMatch[2]));
        codeEl.appendChild(document.createTextNode(cssVarMatch[2]));
      }
    });
  }

  function copyTextToClipboard(text, btn, resetHtml) {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(function () {
        btn.classList.add("copied");
        btn.innerHTML = '<i class="fas fa-check"></i> <span>Copied</span>';
        setTimeout(function () {
          btn.classList.remove("copied");
          btn.innerHTML = resetHtml;
        }, 1800);
      })
      .catch(function (err) {
        console.error("Clipboard copy failed:", err);
      });
  }

  // ── Right TOC & Scroll-Spy ──
  function buildTocAndAnchors() {
    const headings = markdownContent.querySelectorAll("h2, h3");
    tocList.innerHTML = "";
    headingsData = [];

    const usedIds = {};
    headings.forEach(function (heading) {
      const rawText = heading.textContent.trim();
      let id = slugify(rawText) || "section";
      if (usedIds[id]) {
        usedIds[id]++;
        id = id + "-" + usedIds[id];
      } else {
        usedIds[id] = 1;
      }
      heading.id = id;

      const anchor = document.createElement("a");
      anchor.className = "heading-anchor";
      anchor.href = "#" + currentRoute + "@" + encodeURIComponent(id);
      anchor.textContent = "#";
      anchor.title = "Copy link to section";
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        scrollToHeading(id, true);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(window.location.href).catch(function () {});
        }
      });
      heading.appendChild(anchor);

      headingsData.push({ id: id, element: heading });

      const li = document.createElement("li");
      li.className = "toc-item";

      const a = document.createElement("a");
      a.href = "#" + currentRoute + "@" + encodeURIComponent(id);
      a.className = "toc-link toc-" + heading.tagName.toLowerCase();
      a.dataset.headingId = id;
      a.textContent = rawText;
      a.title = rawText;

      a.addEventListener("click", function (e) {
        e.preventDefault();
        scrollToHeading(id, true);
        if (window.innerWidth < 1280) {
          closeAllDrawers();
        }
      });

      li.appendChild(a);
      tocList.appendChild(li);
    });

    if (headingsData.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "toc-empty";
      emptyLi.textContent = "No sub-sections";
      tocList.appendChild(emptyLi);
    }

    tocScrollArea.scrollTop = 0;
    hideTocIndicator();
    requestAnimationFrame(updateTocScrollFades);
  }

  function hideTocIndicator() {
    if (!tocActiveIndicator) return;
    tocActiveIndicator.classList.remove("visible");
  }

  function updateTocIndicator(animate) {
    if (!tocActiveIndicator || !tocListWrap) return;
    const activeLink = tocList.querySelector(".toc-link.active");
    if (!activeLink) {
      hideTocIndicator();
      return;
    }

    const wrapRect = tocListWrap.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    if (!linkRect.height) return;

    const top = Math.round(linkRect.top - wrapRect.top + 3);
    const height = Math.max(16, Math.round(linkRect.height - 6));

    if (!animate) {
      tocActiveIndicator.classList.add("no-transition");
    }

    tocActiveIndicator.style.transform = "translateY(" + top + "px)";
    tocActiveIndicator.style.height = height + "px";
    tocActiveIndicator.classList.add("visible");

    if (!animate) {
      void tocActiveIndicator.offsetHeight;
      requestAnimationFrame(function () {
        tocActiveIndicator.classList.remove("no-transition");
      });
    }
  }

  function updateTocScrollFades() {
    if (!tocSidebar || !tocScrollArea) return;
    const maxScroll = tocScrollArea.scrollHeight - tocScrollArea.clientHeight;
    tocSidebar.classList.toggle("has-top-fade", tocScrollArea.scrollTop > 4);
    tocSidebar.classList.toggle(
      "has-bottom-fade",
      maxScroll > 4 && tocScrollArea.scrollTop < maxScroll - 4
    );
  }

  function clearScrollLock() {
    activeScrollTarget = null;
    lockedTocHeadingId = "";
  }

  function cancelPendingHashSync() {
    if (hashSyncTimer) {
      clearTimeout(hashSyncTimer);
      hashSyncTimer = null;
    }
    pendingHashTarget = "";
  }

  function flushPendingHashSync() {
    if (!pendingHashTarget) return;
    const nextHash = pendingHashTarget;
    cancelPendingHashSync();
    if (window.location.hash !== nextHash) {
      try {
        history.replaceState(null, "", nextHash);
      } catch (e) {
        /* ignore history rate-limit errors */
      }
    }
  }

  function scheduleHashSync(headingId) {
    if (!currentRoute) return;
    const nextHash = headingId
      ? "#" + currentRoute + "@" + encodeURIComponent(headingId)
      : "#" + currentRoute;
    if (window.location.hash === nextHash) {
      cancelPendingHashSync();
      return;
    }
    pendingHashTarget = nextHash;
    if (hashSyncTimer) clearTimeout(hashSyncTimer);
    hashSyncTimer = setTimeout(flushPendingHashSync, 120);
  }

  function setActiveTocHeading(id) {
    if (!id || id === currentActiveHeadingId) return;
    const wasVisible = Boolean(
      tocActiveIndicator && tocActiveIndicator.classList.contains("visible")
    );
    currentActiveHeadingId = id;
    tocList.querySelectorAll(".toc-link").forEach(function (link) {
      const isMatch = link.dataset.headingId === id;
      link.classList.toggle("active", isMatch);

      if (isMatch && !isTocHovered) {
        const linkTop = link.offsetTop;
        const viewHeight = tocScrollArea.clientHeight;
        const scrollTop = tocScrollArea.scrollTop;
        if (linkTop < scrollTop || linkTop > scrollTop + viewHeight - 40) {
          tocScrollArea.scrollTo({
            top: Math.max(0, linkTop - viewHeight / 2),
            behavior: wasVisible ? "smooth" : "instant"
          });
        }
      }
    });
    updateTocIndicator(wasVisible);
  }

  function alignWindowToHeading(id, smooth) {
    const target = document.getElementById(id);
    if (!target) return;
    const top = Math.max(
      0,
      target.getBoundingClientRect().top + window.scrollY - HEADING_SCROLL_OFFSET
    );
    window.scrollTo({ top: top, behavior: smooth ? "smooth" : "instant" });
  }

  function scrollToHeading(id, pushHash, instant) {
    const target = document.getElementById(id);
    if (!target) return Promise.resolve();

    const renderToken = mermaidRenderToken;
    lockedTocHeadingId = id;
    setActiveTocHeading(id);

    const pendingAbove = currentMermaidEntries.filter(function (entry) {
      const isUnrendered =
        entry.renderedTheme !== currentTheme || !entry.canvas.querySelector("svg");
      if (!isUnrendered) return false;
      return Boolean(
        entry.card.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });

    activeScrollTarget = pendingAbove.length
      ? { id: id, token: renderToken }
      : null;

    if (pushHash) {
      cancelPendingHashSync();
      history.replaceState(null, "", "#" + currentRoute + "@" + encodeURIComponent(id));
    }

    if (!instant || pendingAbove.length === 0) {
      alignWindowToHeading(id, !instant);
    }

    if (pendingAbove.length > 0) {
      const renders = pendingAbove.map(function (entry) {
        if (mermaidObserver) {
          mermaidObserver.unobserve(entry.card);
        }
        return queueMermaidEntryRender(entry, renderToken, currentTheme);
      });
      return Promise.all(renders).then(function () {
        if (
          activeScrollTarget &&
          activeScrollTarget.id === id &&
          activeScrollTarget.token === mermaidRenderToken
        ) {
          alignWindowToHeading(id, false);
          activeScrollTarget = null;
        }
      });
    }

    return Promise.resolve();
  }

  function scrollSpy() {
    if (!headingsData.length) return;
    if (lockedTocHeadingId) {
      setActiveTocHeading(lockedTocHeadingId);
      return;
    }

    const atBottom =
      window.scrollY > 0 &&
      window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;

    let activeId = headingsData[0].id;
    if (atBottom) {
      activeId = headingsData[headingsData.length - 1].id;
    } else {
      const activationOffset = 112;
      for (let i = 0; i < headingsData.length; i++) {
        if (headingsData[i].element.getBoundingClientRect().top <= activationOffset) {
          activeId = headingsData[i].id;
        } else {
          break;
        }
      }
    }

    setActiveTocHeading(activeId);
    scheduleHashSync(window.scrollY < 40 ? "" : activeId);
  }

  // ── Event Listeners ──
  function bindEvents() {
    mobileNavBtn.addEventListener("click", toggleNavDrawer);
    mobileTocBtn.addEventListener("click", toggleTocDrawer);
    drawerOverlay.addEventListener("click", closeAllDrawers);

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", function () {
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme, true);
      });
    }

    searchTriggerBtn.addEventListener("click", openSearchModal);

    if (searchModal) {
      searchModal.addEventListener("click", function (e) {
        if (e.target === searchModal) {
          closeSearchModal();
        }
      });
    }

    if (searchModalInput) {
      searchModalInput.addEventListener("input", function (e) {
        renderSearchResults(e.target.value);
      });

      searchModalInput.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          updateSearchSelection(searchSelectedIndex + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          updateSearchSelection(searchSelectedIndex - 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (searchSelectedIndex >= 0 && searchResults[searchSelectedIndex]) {
            selectSearchResult(searchResults[searchSelectedIndex]);
          }
        }
      });
    }

    if (searchModalClearBtn) {
      searchModalClearBtn.addEventListener("click", function () {
        searchModalInput.value = "";
        renderSearchResults("");
        searchModalInput.focus();
      });
    }

    tocSidebar.addEventListener("mouseenter", function () {
      isTocHovered = true;
    });
    tocSidebar.addEventListener("mouseleave", function () {
      isTocHovered = false;
    });
    tocScrollArea.addEventListener("scroll", updateTocScrollFades);

    // Lightbox Controls
    closeLightboxBtn.addEventListener("click", closeLightbox);
    diagramLightbox.addEventListener("click", function (e) {
      if (e.target === diagramLightbox || e.target.id === "diagramLightboxStage") {
        closeLightbox();
      }
    });
    zoomInBtn.addEventListener("click", function () {
      lightboxZoom = Math.min(2.5, +(lightboxZoom + 0.2).toFixed(2));
      applyLightboxZoom();
    });
    zoomOutBtn.addEventListener("click", function () {
      lightboxZoom = Math.max(0.5, +(lightboxZoom - 0.2).toFixed(2));
      applyLightboxZoom();
    });
    zoomResetBtn.addEventListener("click", function () {
      lightboxZoom = 1;
      applyLightboxZoom();
    });

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (searchModal && searchModal.classList.contains("open")) {
          closeSearchModal();
        } else {
          openSearchModal();
        }
      } else if (
        e.key === "/" &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === "Escape") {
        if (searchModal && searchModal.classList.contains("open")) {
          closeSearchModal();
        } else if (diagramLightbox.classList.contains("open")) {
          closeLightbox();
        } else {
          closeAllDrawers();
        }
      }
    });

    window.addEventListener("scroll", scrollSpy);

    window.addEventListener(
      "wheel",
      function (e) {
        if (tocSidebar.contains(e.target) || navSidebar.contains(e.target)) return;
        if (activeScrollTarget || lockedTocHeadingId) {
          clearScrollLock();
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      function (e) {
        if (tocSidebar.contains(e.target) || navSidebar.contains(e.target)) return;
        if (activeScrollTarget || lockedTocHeadingId) {
          clearScrollLock();
        }
      },
      { passive: true }
    );

    window.addEventListener("pointerdown", function (e) {
      if (e.clientX >= document.documentElement.clientWidth) {
        clearScrollLock();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "PageUp" ||
        e.key === "PageDown" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === " "
      ) {
        clearScrollLock();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1280) {
        closeAllDrawers();
      }
      updateTocScrollFades();
      updateTocIndicator(false);
    });

    window.addEventListener("hashchange", function () {
      if (!manifest) return;
      const parsed = parseHash();
      if (parsed.route !== currentRoute) {
        loadPage(parsed.route, parsed.heading);
      } else if (parsed.heading) {
        scrollToHeading(parsed.heading, false);
      }
    });

    window.addEventListener("beforeunload", flushPendingHashSync);
    window.addEventListener("pagehide", flushPendingHashSync);
  }

  // ── Bootstrap ──
  async function init() {
    bindEvents();
    applyTheme(currentTheme, false);
    showLoading(true);

    try {
      const res = await fetch("docs-manifest.json", { cache: "no-cache" });
      if (!res.ok) {
        throw new Error("HTTP " + res.status + " while fetching docs-manifest.json");
      }
      manifest = await res.json();

      flatPages = [];
      (manifest.groups || []).forEach(function (group) {
        (group.pages || []).forEach(function (page) {
          flatPages.push({
            route: group.id + "/" + page.id,
            groupId: group.id,
            groupTitle: group.title,
            id: page.id,
            title: page.title,
            file: page.file,
            summary: page.summary || ""
          });
        });
      });

      const defaultRoute = manifest.defaultPage || (flatPages[0] && flatPages[0].route) || "";
      if (brandHomeLink && defaultRoute) {
        brandHomeLink.setAttribute("href", "#" + defaultRoute);
      }

      renderNavTree();

      const initial = parseHash();
      const matchedInitial = findPageByRoute(initial.route);
      const targetRoute = matchedInitial ? matchedInitial.route : defaultRoute;
      if (initial.route && !matchedInitial && targetRoute) {
        history.replaceState(null, "", "#" + targetRoute);
      }
      await loadPage(targetRoute, matchedInitial ? initial.heading : "", true);
    } catch (err) {
      console.error("Failed to initialize documentation portal:", err);
      showError(
        "Failed to initialize documentation portal",
        "Could not load docs-manifest.json. " + err.message,
        buildFileCorsTip()
      );
      showLoading(false);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
