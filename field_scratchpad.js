/**
 * Bold Bovine OS — Universal Field Scratchpad & Sprint Staging Widget
 * Dual Theme Support: Rural Broadsheet (Cardstock/Letterpress) & Hearth (Warm Espresso)
 */
(function() {
  if (window.__BoldBovineScratchpadLoaded) return;
  window.__BoldBovineScratchpadLoaded = true;

  const STORAGE_KEY = "bold_bovine_scratchpad_v1";
  const PRIMARY_ZONES = [
    "Shop / Garage",
    "Home / Interior",
    "Pastures / Land",
    "Office / Desk",
    "Mobile / Vehicles"
  ];
  const SPRINT_PRESETS = [
    "🌱 Spring 2027",
    "⚡ Immediate Sprint",
    "🌾 Summer Operations",
    "🍂 Fall Maintenance",
    "📅 Routine Backlog"
  ];

  function getObservations() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch(e) {
      return [];
    }
  }

  function saveObservations(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      updateBadge();
      window.dispatchEvent(new Event("scratchpad_updated"));
    } catch(e) {}
  }

  function getPageContext() {
    const title = document.title || "Bold Bovine OS";
    const path = window.location.pathname.split("/").pop() || "index.html";
    return { title, path };
  }

  // Dual Theme CSS
  const STYLES = `
    /* SCRATCHPAD THEME VARIABLES */
    :root, [data-theme="broadsheet"] {
      --sp-bg-drawer: #fdfaf5;
      --sp-bg-card: #ffffff;
      --sp-bg-input: #f7f3ea;
      --sp-ink: #111111;
      --sp-ink-muted: #4b5563;
      --sp-ink-dim: #6b7280;
      --sp-border: 1.5px solid #111111;
      --sp-shadow: 3px 3px 0px #111111;
      --sp-shadow-hover: 4px 4px 0px #111111;
      --sp-forest: #1b4332;
      --sp-amber: #b45309;
      --sp-oxblood: #991b1b;
      --sp-navy: #1e3a8a;
    }

    [data-theme="hearth"] {
      --sp-bg-drawer: #171412;
      --sp-bg-card: #221d1a;
      --sp-bg-input: #1a1613;
      --sp-ink: #f5f0e8;
      --sp-ink-muted: #c7beaf;
      --sp-ink-dim: #8f8576;
      --sp-border: 1px solid rgba(214, 180, 140, 0.25);
      --sp-shadow: 3px 3px 0px #0c0a09;
      --sp-shadow-hover: 4px 4px 0px #0c0a09;
      --sp-forest: #4ade80;
      --sp-amber: #f59e0b;
      --sp-oxblood: #f87171;
      --sp-navy: #60a5fa;
    }

    #bb-scratchpad-trigger {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999990;
      background: var(--sp-bg-card);
      border: var(--sp-border);
      color: var(--sp-ink);
      padding: 9px 16px;
      border-radius: 4px;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      box-shadow: var(--sp-shadow);
      transition: all 0.15s ease;
      user-select: none;
    }
    #bb-scratchpad-trigger:hover {
      box-shadow: var(--sp-shadow-hover);
      transform: translate(-1px, -1px);
    }
    #bb-scratchpad-trigger .trigger-badge {
      background: var(--sp-forest);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 3px;
      min-width: 18px;
      text-align: center;
    }
    #bb-scratchpad-trigger .trigger-badge.has-urgent {
      background: var(--sp-oxblood);
      animation: bbPulse 2s infinite;
    }

    #bb-scratchpad-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(2px);
      z-index: 999995;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
    #bb-scratchpad-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    #bb-scratchpad-drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: min(520px, 94vw);
      height: 100vh;
      background: var(--sp-bg-drawer);
      border-left: var(--sp-border);
      box-shadow: -8px 0 24px rgba(0,0,0,0.3);
      z-index: 1000000;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: var(--sp-ink);
    }
    #bb-scratchpad-drawer.active {
      transform: translateX(0);
    }

    .bb-drawer-header {
      padding: 18px 24px;
      border-bottom: 3px double var(--sp-ink);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--sp-bg-drawer);
    }
    .bb-drawer-title-group h2 {
      font-family: 'Newsreader', Georgia, serif;
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.01em;
    }
    .bb-drawer-title-group .bb-subtitle {
      font-size: 11px;
      color: var(--sp-ink-dim);
      margin-top: 2px;
      font-family: 'Space Mono', monospace;
    }
    .bb-btn-close {
      background: var(--sp-bg-card);
      border: var(--sp-border);
      color: var(--sp-ink);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 10px;
      box-shadow: 2px 2px 0px var(--sp-ink);
      transition: all 0.15s ease;
    }
    .bb-btn-close:hover {
      transform: translate(-1px, -1px);
    }

    .bb-drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .bb-form-card {
      background: var(--sp-bg-card);
      border: var(--sp-border);
      box-shadow: var(--sp-shadow);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-radius: 4px;
    }
    .bb-textarea {
      width: 100%;
      min-height: 80px;
      background: var(--sp-bg-input);
      border: var(--sp-border);
      border-radius: 2px;
      padding: 12px;
      color: var(--sp-ink);
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      line-height: 1.4;
      box-sizing: border-box;
      outline: none;
    }
    .bb-form-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .bb-field-group {
      flex: 1;
      min-width: 130px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bb-field-label {
      font-size: 10px;
      font-weight: 800;
      color: var(--sp-ink-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .bb-select, .bb-input {
      background: var(--sp-bg-input);
      border: var(--sp-border);
      border-radius: 2px;
      padding: 7px 10px;
      color: var(--sp-ink);
      font-size: 12px;
      outline: none;
      box-sizing: border-box;
      width: 100%;
    }
    .bb-btn-submit {
      background: var(--sp-forest);
      border: var(--sp-border);
      box-shadow: 2px 2px 0px var(--sp-ink);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      padding: 10px 16px;
      cursor: pointer;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      transition: all 0.15s ease;
    }
    .bb-btn-submit:hover {
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0px var(--sp-ink);
    }

    .bb-filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .bb-tabs {
      display: flex;
      border: var(--sp-border);
      background: var(--sp-bg-input);
    }
    .bb-tab-btn {
      background: transparent;
      border: none;
      color: var(--sp-ink-muted);
      font-size: 11px;
      font-weight: 700;
      padding: 5px 10px;
      cursor: pointer;
    }
    .bb-tab-btn.active {
      background: var(--sp-ink);
      color: var(--sp-bg-drawer);
    }
    .bb-zone-filter {
      background: var(--sp-bg-card);
      border: var(--sp-border);
      color: var(--sp-ink);
      font-size: 11px;
      padding: 5px 8px;
      outline: none;
    }

    .bb-obs-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bb-obs-card {
      background: var(--sp-bg-card);
      border: var(--sp-border);
      box-shadow: var(--sp-shadow);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-radius: 3px;
      transition: all 0.15s ease;
    }
    .bb-obs-card.resolved {
      opacity: 0.55;
    }
    .bb-obs-card.resolved .bb-obs-text {
      text-decoration: line-through;
    }
    .bb-obs-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      font-size: 11px;
    }
    .bb-pill {
      padding: 2px 7px;
      font-weight: 700;
      font-size: 10px;
      font-family: 'Space Mono', monospace;
      border: var(--sp-border);
      border-radius: 2px;
    }
    .bb-pill-zone { background: rgba(30, 58, 138, 0.08); color: var(--sp-navy); }
    .bb-pill-sprint { background: rgba(27, 67, 50, 0.08); color: var(--sp-forest); }
    .bb-pill-urgent { background: rgba(153, 27, 27, 0.1); color: var(--sp-oxblood); }
    .bb-pill-op { background: rgba(180, 83, 9, 0.08); color: var(--sp-amber); }
    .bb-pill-page { color: var(--sp-ink-dim); border-color: var(--sp-ink-dim); }
    .bb-obs-time {
      color: var(--sp-ink-dim);
      font-size: 10px;
      margin-left: auto;
      font-family: 'Space Mono', monospace;
    }
    .bb-obs-text {
      font-size: 13px;
      line-height: 1.5;
      color: var(--sp-ink);
      white-space: pre-wrap;
    }
    .bb-obs-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      border-top: 1px solid rgba(17, 17, 17, 0.15);
      padding-top: 8px;
    }
    .bb-btn-action {
      background: var(--sp-bg-input);
      border: var(--sp-border);
      color: var(--sp-ink);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .bb-btn-action:hover {
      background: var(--sp-ink);
      color: var(--sp-bg-drawer);
    }

    .bb-drawer-footer {
      padding: 14px 24px;
      border-top: 3px double var(--sp-ink);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--sp-bg-drawer);
      gap: 8px;
      flex-wrap: wrap;
    }
    .bb-footer-btn {
      background: var(--sp-bg-card);
      border: var(--sp-border);
      box-shadow: 2px 2px 0px var(--sp-ink);
      color: var(--sp-ink);
      font-size: 11px;
      font-weight: 800;
      padding: 6px 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .bb-footer-btn:hover {
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0px var(--sp-ink);
    }

    #bb-toast {
      position: fixed;
      bottom: 84px;
      right: 24px;
      z-index: 1000005;
      background: var(--sp-forest);
      border: var(--sp-border);
      box-shadow: 3px 3px 0px var(--sp-ink);
      color: #fff;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 800;
      opacity: 0;
      transform: translateY(10px);
      pointer-events: none;
      transition: all 0.2s ease;
    }
    #bb-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  const triggerBtn = document.createElement("div");
  triggerBtn.id = "bb-scratchpad-trigger";
  triggerBtn.innerHTML = `
    <span>📝 Field Scratchpad</span>
    <span class="trigger-badge" id="bb-trigger-count">0</span>
  `;

  const overlayEl = document.createElement("div");
  overlayEl.id = "bb-scratchpad-overlay";

  const drawerEl = document.createElement("div");
  drawerEl.id = "bb-scratchpad-drawer";
  drawerEl.innerHTML = `
    <div class="bb-drawer-header">
      <div class="bb-drawer-title-group">
        <h2>Field Scratchpad & Sprint Staging</h2>
        <div class="bb-subtitle" id="bb-page-context-sub">Context: Page • Alt+S to toggle</div>
      </div>
      <button class="bb-btn-close" id="bb-btn-close-drawer" title="Close (Esc)">✕</button>
    </div>

    <div class="bb-drawer-body">
      <div class="bb-form-card">
        <textarea class="bb-textarea" id="bb-input-text" placeholder="Notice something broken, worn, needed, or staged for next sprint? Type note here... (Ctrl+Enter to save)"></textarea>
        
        <div class="bb-form-row">
          <div class="bb-field-group">
            <span class="bb-field-label">Primary Operating Zone</span>
            <select class="bb-select" id="bb-input-zone">
              ${PRIMARY_ZONES.map(z => `<option value="${z}">${z}</option>`).join("")}
            </select>
          </div>
          <div class="bb-field-group">
            <span class="bb-field-label">Target Sprint / Horizon</span>
            <select class="bb-select" id="bb-input-sprint">
              ${SPRINT_PRESETS.map(s => `<option value="${s}">${s}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="bb-form-row">
          <div class="bb-field-group">
            <span class="bb-field-label">Assigned Operator</span>
            <select class="bb-select" id="bb-input-op">
              <option value="Josh">Josh (Physical Execution)</option>
              <option value="Joint">Joint (Josh + AI Collaborative)</option>
            </select>
          </div>
          <div class="bb-field-group">
            <span class="bb-field-label">Urgency</span>
            <select class="bb-select" id="bb-input-urgency">
              <option value="normal">Routine Observation</option>
              <option value="urgent">⚠️ Urgent Attention</option>
            </select>
          </div>
        </div>

        <button class="bb-btn-submit" id="bb-btn-save-obs">
          <span>+ Stage Observation</span>
        </button>
      </div>

      <div class="bb-filter-bar">
        <div class="bb-tabs">
          <button class="bb-tab-btn active" data-tab="all" id="bb-tab-all">All (<span id="bb-count-all">0</span>)</button>
          <button class="bb-tab-btn" data-tab="page" id="bb-tab-page">This Page (<span id="bb-count-page">0</span>)</button>
          <button class="bb-tab-btn" data-tab="resolved" id="bb-tab-resolved">Resolved (<span id="bb-count-resolved">0</span>)</button>
        </div>
        <select class="bb-zone-filter" id="bb-filter-zone">
          <option value="">All Zones</option>
          ${PRIMARY_ZONES.map(z => `<option value="${z}">${z}</option>`).join("")}
        </select>
      </div>

      <div class="bb-obs-list" id="bb-obs-container"></div>
    </div>

    <div class="bb-drawer-footer">
      <div style="display:flex; gap:8px;">
        <button class="bb-footer-btn" id="bb-btn-export-md">📥 Export Markdown</button>
        <button class="bb-footer-btn" id="bb-btn-copy-all">📋 Copy All</button>
      </div>
      <button class="bb-footer-btn" id="bb-btn-clear-resolved" style="color:var(--sp-ink-dim);">Clear Resolved</button>
    </div>
  `;

  const toastEl = document.createElement("div");
  toastEl.id = "bb-toast";
  toastEl.textContent = "Observation saved!";

  document.body.appendChild(triggerBtn);
  document.body.appendChild(overlayEl);
  document.body.appendChild(drawerEl);
  document.body.appendChild(toastEl);

  let activeTab = "all";
  let activeZoneFilter = "";

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function toggleDrawer(open) {
    const shouldOpen = open !== undefined ? open : !drawerEl.classList.contains("active");
    if (shouldOpen) {
      drawerEl.classList.add("active");
      overlayEl.classList.add("active");
      const ctx = getPageContext();
      document.getElementById("bb-page-context-sub").textContent = `Context: ${ctx.title} (${ctx.path}) • Alt+S`;
      renderList();
      setTimeout(() => document.getElementById("bb-input-text").focus(), 150);
    } else {
      drawerEl.classList.remove("active");
      overlayEl.classList.remove("active");
    }
  }

  function updateBadge() {
    const list = getObservations();
    const openItems = list.filter(i => i.status !== "resolved");
    const countEl = document.getElementById("bb-trigger-count");
    if (countEl) {
      countEl.textContent = openItems.length;
      const hasUrgent = openItems.some(i => i.urgency === "urgent");
      if (hasUrgent) {
        countEl.classList.add("has-urgent");
      } else {
        countEl.classList.remove("has-urgent");
      }
    }
  }

  function renderList() {
    const list = getObservations();
    const ctx = getPageContext();

    const allCount = list.filter(i => i.status !== "resolved").length;
    const pageCount = list.filter(i => i.status !== "resolved" && (i.pageTitle === ctx.title || i.pagePath === ctx.path)).length;
    const resCount = list.filter(i => i.status === "resolved").length;

    document.getElementById("bb-count-all").textContent = allCount;
    document.getElementById("bb-count-page").textContent = pageCount;
    document.getElementById("bb-count-resolved").textContent = resCount;

    let filtered = list;
    if (activeTab === "all") {
      filtered = filtered.filter(i => i.status !== "resolved");
    } else if (activeTab === "page") {
      filtered = filtered.filter(i => i.status !== "resolved" && (i.pageTitle === ctx.title || i.pagePath === ctx.path));
    } else if (activeTab === "resolved") {
      filtered = filtered.filter(i => i.status === "resolved");
    }

    if (activeZoneFilter) {
      filtered = filtered.filter(i => i.zone === activeZoneFilter);
    }

    const container = document.getElementById("bb-obs-container");
    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px 10px; color:var(--sp-ink-dim); font-size:13px;">
          No observations found in this view.<br>Use the dispatch box above to stage field notes.
        </div>
      `;
      return;
    }

    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    container.innerHTML = filtered.map(item => {
      const isResolved = item.status === "resolved";
      const dateStr = new Date(item.timestamp).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
      });

      return `
        <div class="bb-obs-card ${isResolved ? 'resolved' : ''}" data-id="${item.id}">
          <div class="bb-obs-meta">
            <span class="bb-pill bb-pill-zone">${escapeHtml(item.zone)}</span>
            <span class="bb-pill bb-pill-sprint">${escapeHtml(item.sprint)}</span>
            <span class="bb-pill bb-pill-op">👤 ${escapeHtml(item.operator || 'Josh')}</span>
            ${item.urgency === 'urgent' ? '<span class="bb-pill bb-pill-urgent">⚠️ Urgent</span>' : ''}
            <span class="bb-pill bb-pill-page" title="${escapeHtml(item.pageTitle)}">${escapeHtml(item.pagePath)}</span>
            <span class="bb-obs-time">${dateStr}</span>
          </div>

          <div class="bb-obs-text">${escapeHtml(item.text)}</div>

          <div class="bb-obs-actions">
            <button class="bb-btn-action btn-copy" onclick="window.__BoldBovineScratchpad.copyItem('${item.id}')" title="Copy as Atomic Task">
              📋 Copy Task
            </button>
            <button class="bb-btn-action btn-done" onclick="window.__BoldBovineScratchpad.toggleDone('${item.id}')">
              ${isResolved ? '↩ Reopen' : '✓ Resolve'}
            </button>
            <button class="bb-btn-action btn-del" onclick="window.__BoldBovineScratchpad.deleteItem('${item.id}')">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  function addObservation() {
    const textEl = document.getElementById("bb-input-text");
    const text = textEl.value.trim();
    if (!text) {
      textEl.focus();
      return;
    }

    const zone = document.getElementById("bb-input-zone").value;
    const sprint = document.getElementById("bb-input-sprint").value;
    const op = document.getElementById("bb-input-op").value;
    const urgency = document.getElementById("bb-input-urgency").value;
    const ctx = getPageContext();

    const newItem = {
      id: "obs_" + Date.now(),
      text: text,
      zone: zone,
      sprint: sprint,
      operator: op,
      urgency: urgency,
      pageTitle: ctx.title,
      pagePath: ctx.path,
      timestamp: new Date().toISOString(),
      status: "open"
    };

    const list = getObservations();
    list.unshift(newItem);
    saveObservations(list);

    textEl.value = "";
    showToast("✓ Observation staged for " + sprint);
    renderList();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.__BoldBovineScratchpad = {
    toggle: toggleDrawer,
    openWith: function(opts) {
      toggleDrawer(true);
      if (opts.text) document.getElementById("bb-input-text").value = opts.text;
      if (opts.zone) document.getElementById("bb-input-zone").value = opts.zone;
      if (opts.sprint) document.getElementById("bb-input-sprint").value = opts.sprint;
      document.getElementById("bb-input-text").focus();
    },
    copyItem: function(id) {
      const list = getObservations();
      const item = list.find(i => i.id === id);
      if (!item) return;

      const taskLine = `Inspect / Address: ${item.text} | Zone: ${item.zone} | Assigned: ${item.operator} | Horizon: ${item.sprint} | Source: ${item.pagePath} (${new Date(item.timestamp).toLocaleDateString()})`;
      navigator.clipboard.writeText(taskLine).then(() => {
        showToast("📋 Task copied for Master Ledger!");
      });
    },
    toggleDone: function(id) {
      const list = getObservations();
      const item = list.find(i => i.id === id);
      if (!item) return;
      item.status = item.status === "resolved" ? "open" : "resolved";
      saveObservations(list);
      renderList();
    },
    deleteItem: function(id) {
      let list = getObservations();
      list = list.filter(i => i.id !== id);
      saveObservations(list);
      renderList();
    }
  };

  triggerBtn.addEventListener("click", () => toggleDrawer());
  overlayEl.addEventListener("click", () => toggleDrawer(false));
  document.getElementById("bb-btn-close-drawer").addEventListener("click", () => toggleDrawer(false));
  document.getElementById("bb-btn-save-obs").addEventListener("click", addObservation);

  document.getElementById("bb-input-text").addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      addObservation();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      toggleDrawer();
    } else if (e.key === "Escape" && drawerEl.classList.contains("active")) {
      toggleDrawer(false);
    }
  });

  document.querySelectorAll(".bb-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bb-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.getAttribute("data-tab");
      renderList();
    });
  });

  document.getElementById("bb-filter-zone").addEventListener("change", (e) => {
    activeZoneFilter = e.target.value;
    renderList();
  });

  document.getElementById("bb-btn-export-md").addEventListener("click", () => {
    const list = getObservations();
    if (list.length === 0) {
      alert("No observations to export.");
      return;
    }

    let md = `# Bold Bovine OS — Field Observations & Sprint Staging Log\n`;
    md += `*Exported on: ${new Date().toLocaleString()}*\n\n`;
    md += `| Date | Primary Zone | Sprint / Horizon | Operator | Origin Page | Observation / Task | Status |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    list.forEach(i => {
      const d = new Date(i.timestamp).toLocaleDateString();
      const cleanText = i.text.replace(/\|/g, "-").replace(/\n/g, " ");
      md += `| ${d} | **${i.zone}** | ${i.sprint} | ${i.operator} | ${i.pagePath} | ${cleanText} | ${i.status.toUpperCase()} |\n`;
    });

    md += `\n\n## Formatted Atomic Tasks for Master Ledger\n\n`;
    list.filter(i => i.status !== "resolved").forEach(i => {
      md += `* [ ] ${i.text} [Zone: ${i.zone}] [Operator: ${i.operator}] [Sprint: ${i.sprint}]\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Field_Observations_Spring_Log_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("📥 Exported Markdown file!");
  });

  document.getElementById("bb-btn-copy-all").addEventListener("click", () => {
    const list = getObservations().filter(i => i.status !== "resolved");
    if (list.length === 0) {
      showToast("No active observations to copy.");
      return;
    }
    const lines = list.map(i => `* [ ] ${i.text} | Zone: ${i.zone} | Operator: ${i.operator} | Sprint: ${i.sprint} | Logged: ${new Date(i.timestamp).toLocaleDateString()}`);
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      showToast(`📋 Copied ${list.length} tasks to clipboard!`);
    });
  });

  document.getElementById("bb-btn-clear-resolved").addEventListener("click", () => {
    let list = getObservations();
    const before = list.length;
    list = list.filter(i => i.status !== "resolved");
    if (list.length === before) {
      showToast("No resolved items to clear.");
      return;
    }
    saveObservations(list);
    renderList();
    showToast("Cleared resolved items.");
  });

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      updateBadge();
      if (drawerEl.classList.contains("active")) {
        renderList();
      }
    }
  });

  updateBadge();
})();
