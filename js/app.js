/* Site Photo Checklist Builder – UI logic */
(function () {
  "use strict";

  const DATA = window.CHECKLIST_DATA;
  const STORE_KEY = "photo-checklist-state-v1";
  const $ = (id) => document.getElementById(id);
  const selected = new Set(); // keys "catId::optionName"
  const key = (cat, opt) => cat.id + "::" + opt.name;

  const FIELD_IDS = { site: "f-site", siteId: "f-siteid", date: "f-date" };

  /* ---------- persistence (per-browser convenience only) ---------- */
  function save() {
    try {
      const fields = {};
      for (const [k, id] of Object.entries(FIELD_IDS)) fields[k] = $(id).value;
      localStorage.setItem(STORE_KEY, JSON.stringify({ selected: [...selected], fields }));
    } catch (_) { /* storage unavailable */ }
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!s) return;
      (s.selected || []).forEach((k) => selected.add(k));
      for (const [k, id] of Object.entries(FIELD_IDS)) if (s.fields && s.fields[k]) $(id).value = s.fields[k];
    } catch (_) { /* ignore */ }
  }

  /* ---------- build the checklist from selections ---------- */
  function buildSections() {
    const sections = [{ title: "General", category: "Always applies", items: DATA.generic.items.slice() }];
    for (const cat of DATA.categories) {
      for (const opt of cat.options) {
        if (selected.has(key(cat, opt))) {
          sections.push({ title: opt.name, category: cat.name, items: opt.items.slice() });
        }
      }
    }
    return sections;
  }

  function selectionSummary() {
    return DATA.categories.map((cat) => ({
      category: cat.name,
      values: cat.options.filter((o) => selected.has(key(cat, o))).map((o) => o.name),
    }));
  }

  /* ---------- render ---------- */
  function renderCategories() {
    const host = $("categories");
    host.innerHTML = "";
    for (const cat of DATA.categories) {
      const box = document.createElement("div");
      box.className = "cat";
      const head = document.createElement("div");
      head.className = "cat-head";
      const h = document.createElement("h3");
      h.textContent = cat.name;
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "none";
      clear.textContent = "clear";
      clear.addEventListener("click", () => {
        cat.options.forEach((o) => selected.delete(key(cat, o)));
        renderCategories(); update();
      });
      head.append(h, clear);

      const chips = document.createElement("div");
      chips.className = "chips";
      for (const opt of cat.options) {
        const lab = document.createElement("label");
        lab.className = "chip";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = selected.has(key(cat, opt));
        input.addEventListener("change", () => {
          input.checked ? selected.add(key(cat, opt)) : selected.delete(key(cat, opt));
          update();
        });
        const span = document.createElement("span");
        span.textContent = opt.name + " ";
        const small = document.createElement("small");
        small.textContent = "(" + opt.items.length + ")";
        span.appendChild(small);
        lab.append(input, span);
        chips.appendChild(lab);
      }
      box.append(head, chips);
      host.appendChild(box);
    }
  }

  function renderPreview() {
    const sections = buildSections();
    const total = sections.reduce((n, s) => n + s.items.length, 0);
    $("count").textContent = total + " items in " + sections.length + " section" + (sections.length === 1 ? "" : "s");
    const host = $("preview");
    host.innerHTML = "";
    sections.forEach((s, i) => {
      const el = document.createElement(i === 0 ? "details" : "div");
      el.className = "sec";
      const h = document.createElement("h4");
      h.textContent = s.title + " ";
      const em = document.createElement("em");
      em.textContent = "– " + s.category + " (" + s.items.length + ")";
      h.appendChild(em);
      if (i === 0) {
        const sum = document.createElement("summary");
        sum.appendChild(h);
        el.appendChild(sum);
      } else el.appendChild(h);
      const ol = document.createElement("ol");
      s.items.forEach((it) => { const li = document.createElement("li"); li.textContent = it; ol.appendChild(li); });
      el.appendChild(ol);
      host.appendChild(el);
    });
  }

  function update() { renderPreview(); save(); }

  /* ---------- actions ---------- */
  async function onGenerate() {
    const btn = $("btn-pdf");
    btn.disabled = true;
    $("status").textContent = "Building PDF…";
    try {
      const info = {};
      for (const [k, id] of Object.entries(FIELD_IDS)) info[k] = $(id).value.trim();
      const bytes = await window.ChecklistPDF.build({
        info,
        selections: selectionSummary(),
        sections: buildSections(),
      });
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      // File name: "<Site name> <date created>.pdf"
      const siteName = info.site.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "Photo Checklist";
      a.href = url;
      a.download = siteName + " " + todayLocal() + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      $("status").textContent = "PDF downloaded: " + a.download;
    } catch (err) {
      console.error(err);
      $("status").textContent = "Could not build the PDF: " + err.message;
    } finally {
      btn.disabled = false;
    }
  }

  function todayLocal() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function onNewForm() {
    const hasData = selected.size > 0 || $("f-site").value.trim() || $("f-siteid").value.trim();
    if (hasData && !window.confirm("Start a new form? This clears the site details and all selections.")) return;
    selected.clear();
    $("f-site").value = "";
    $("f-siteid").value = "";
    $("f-date").value = todayLocal();
    try { localStorage.removeItem(STORE_KEY); } catch (_) { /* ignore */ }
    renderCategories();
    renderPreview();
    $("status").textContent = "New form started.";
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("f-site").focus();
  }

  function onReset() {
    selected.clear();
    renderCategories();
    update();
    $("status").textContent = "";
  }

  /* ---------- init ---------- */
  load();
  if (!$("f-date").value) $("f-date").value = todayLocal();
  $("btn-new").addEventListener("click", onNewForm);
  Object.values(FIELD_IDS).forEach((id) => $(id).addEventListener("input", save));
  $("btn-pdf").addEventListener("click", onGenerate);
  $("btn-reset").addEventListener("click", onReset);
  renderCategories();
  renderPreview();

  // expose for testing
  window.__checklist = { buildSections, selected, key, DATA };
})();
