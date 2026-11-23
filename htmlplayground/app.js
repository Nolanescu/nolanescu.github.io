(function () {
  "use strict";

  const STORAGE_KEY = "virus_htmlplayground_state_v1";

  const FALLBACK_BLANK = {
    html: `<h1>My Page</h1>\n<p>Start writing HTML here!</p>\n`,
    css: `body {\n  font-family: system-ui, sans-serif;\n  padding: 20px;\n}\n`
  };

  const exampleSelect = document.getElementById("example-select");
  const resetBtn = document.getElementById("reset-btn");
  const downloadBtn = document.getElementById("download-btn");
  const editorStatus = document.getElementById("editor-status");

  const editorPane = document.getElementById("editor-pane");
  const previewPane = document.getElementById("preview-pane");
  const panelHtml = document.getElementById("panel-html");
  const panelCss = document.getElementById("panel-css");
  const htmlTextarea = document.getElementById("html-input");
  const cssTextarea = document.getElementById("css-input");
  const previewFrame = document.getElementById("preview-frame");
  const resizer = document.getElementById("resizer");
  const workspace = document.getElementById("workspace");

  const tabButtons = document.querySelectorAll(".tab-btn");
  const sizeButtons = document.querySelectorAll(".size-btn");

  let htmlEditor = null;
  let cssEditor = null;
  let updateTimer = null;
  let activeCodeTab = "html";

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.html === "string" && typeof parsed.css === "string") {
        return parsed;
      }
    } catch (_err) {
      // Ignore storage errors
    }
    return null;
  }

  function saveState(exampleKey, html, css) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ exampleKey, html, css }));
      if (editorStatus) editorStatus.textContent = "Auto-saved";
    } catch (_err) {
      // Ignore storage errors
    }
  }

  function getHtml() {
    return htmlEditor ? htmlEditor.getValue() : htmlTextarea.value;
  }

  function getCss() {
    return cssEditor ? cssEditor.getValue() : cssTextarea.value;
  }

  function setCode(html, css) {
    if (htmlEditor) {
      htmlEditor.setValue(html);
    } else {
      htmlTextarea.value = html;
    }
    if (cssEditor) {
      cssEditor.setValue(css);
    } else {
      cssTextarea.value = css;
    }
    renderPreview();
  }

  function buildDocument(html, css) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
${css}
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }

  function renderPreview() {
    const html = getHtml();
    const css = getCss();
    previewFrame.srcdoc = buildDocument(html, css);
  }

  function scheduleUpdate() {
    if (editorStatus) editorStatus.textContent = "Updating...";
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      renderPreview();
      saveState(exampleSelect.value, getHtml(), getCss());
    }, 120);
  }

  async function fetchExampleFiles(id) {
    const base = `examples/${encodeURIComponent(id)}`;
    const [htmlRes, cssRes] = await Promise.all([
      fetch(`${base}/index.html`, { cache: "no-store" }),
      fetch(`${base}/styles.css`, { cache: "no-store" })
    ]);
    if (!htmlRes.ok || !cssRes.ok) {
      throw new Error(`Failed to load example: ${id}`);
    }
    const [html, css] = await Promise.all([htmlRes.text(), cssRes.text()]);
    return { html, css };
  }

  async function loadExample(id) {
    if (editorStatus) editorStatus.textContent = "Loading...";
    try {
      const { html, css } = await fetchExampleFiles(id);
      setCode(html, css);
      saveState(id, html, css);
    } catch (_err) {
      setCode(FALLBACK_BLANK.html, FALLBACK_BLANK.css);
      if (editorStatus) editorStatus.textContent = "Auto-saved";
    }
  }

  async function loadManifest(preferredId) {
    try {
      const res = await fetch("examples/manifest.json", { cache: "no-store" });
      if (!res.ok) return;
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) return;

      exampleSelect.innerHTML = "";
      items.forEach((item) => {
        if (!item || !item.id) return;
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.title || item.id;
        exampleSelect.appendChild(opt);
      });

      const hasPreferred = preferredId && items.some((item) => item.id === preferredId);
      exampleSelect.value = hasPreferred ? preferredId : items[0].id;
    } catch (_err) {
      // Keep default option if manifest fetch fails
    }
  }

  function initEditors(initialHtml, initialCss) {
    if (typeof window.CodeMirror === "function") {
      htmlEditor = window.CodeMirror.fromTextArea(htmlTextarea, {
        mode: "htmlmixed",
        theme: "material-darker",
        inputStyle: "contenteditable",
        lineNumbers: true,
        tabSize: 2,
        indentUnit: 2,
        lineWrapping: true,
        autoCloseTags: true,
        autoCloseBrackets: true,
        styleActiveLine: true
      });

      cssEditor = window.CodeMirror.fromTextArea(cssTextarea, {
        mode: "css",
        theme: "material-darker",
        inputStyle: "contenteditable",
        lineNumbers: true,
        tabSize: 2,
        indentUnit: 2,
        lineWrapping: true,
        autoCloseBrackets: true,
        styleActiveLine: true
      });

      htmlEditor.setValue(initialHtml);
      cssEditor.setValue(initialCss);

      htmlEditor.on("change", scheduleUpdate);
      cssEditor.on("change", scheduleUpdate);
    } else {
      // Fallback if CDN is unavailable
      htmlTextarea.value = initialHtml;
      cssTextarea.value = initialCss;
      htmlTextarea.addEventListener("input", scheduleUpdate);
      cssTextarea.addEventListener("input", scheduleUpdate);
    }
  }

  function switchTab(target) {
    if (target === "preview") {
      editorPane.classList.remove("active-mobile");
      previewPane.classList.add("active-mobile");
      renderPreview();
    } else {
      activeCodeTab = target;
      previewPane.classList.remove("active-mobile");
      editorPane.classList.add("active-mobile");

      panelHtml.classList.toggle("active", target === "html");
      panelCss.classList.toggle("active", target === "css");

      if (target === "html" && htmlEditor) {
        requestAnimationFrame(() => htmlEditor.refresh());
      } else if (target === "css" && cssEditor) {
        requestAnimationFrame(() => cssEditor.refresh());
      }
    }

    tabButtons.forEach((btn) => {
      const btnTab = btn.getAttribute("data-tab");
      const isMatch =
        target === "preview"
          ? btnTab === "preview"
          : btnTab === activeCodeTab;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-selected", String(isMatch));
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      if (target) switchTab(target);
    });
  });

  // Preview width toggle (desktop)
  sizeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      sizeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const width = btn.getAttribute("data-width");
      previewFrame.classList.toggle("phone-width", width === "390px");
    });
  });

  // Example switcher
  exampleSelect.addEventListener("change", () => {
    loadExample(exampleSelect.value);
  });

  // Reset current example from server files
  resetBtn.addEventListener("click", () => {
    loadExample(exampleSelect.value);
  });

  // Download single self-contained HTML file
  downloadBtn.addEventListener("click", () => {
    const content = buildDocument(getHtml(), getCss());
    const blob = new Blob([content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-webpage.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // Desktop split resizer
  let isDragging = false;

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isDragging = true;
    resizer.classList.add("dragging");
    previewFrame.style.pointerEvents = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const rect = workspace.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    const pct = Math.min(78, Math.max(22, (offset / rect.width) * 100));
    editorPane.style.width = pct + "%";
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    resizer.classList.remove("dragging");
    previewFrame.style.pointerEvents = "";
  });

  // Initialize state
  async function boot() {
    const saved = loadSavedState();
    initEditors(
      saved ? saved.html : FALLBACK_BLANK.html,
      saved ? saved.css : FALLBACK_BLANK.css
    );
    renderPreview();

    await loadManifest(saved ? saved.exampleKey : "blank");

    if (!saved) {
      await loadExample(exampleSelect.value || "blank");
    }
  }

  boot();
})();
