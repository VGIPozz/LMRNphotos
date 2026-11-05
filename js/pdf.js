/* Fillable PDF generator – uses pdf-lib (vendor/pdf-lib.min.js) */
(function () {
  "use strict";

  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const PAGE_W = 612, PAGE_H = 792;          // US Letter, points
  const M = 36;                               // margin
  const CONTENT_W = PAGE_W - 2 * M;
  const FOOTER_H = 22;

  // Item table columns
  const COL_NUM = 22;     // item number
  const COL_CHECK = 34;   // "Done" checkbox
  const COL_NA = 30;      // "N/A" checkbox
  const COL_NOTES = 170;  // notes field
  const COL_ITEM = CONTENT_W - COL_NUM - COL_CHECK - COL_NA - COL_NOTES;

  const FS = 9;           // item font size
  const LH = 11;          // line height
  const PAD = 5;          // vertical padding inside a row

  const C = {
    ink: rgb(0.11, 0.15, 0.2),
    muted: rgb(0.38, 0.42, 0.48),
    accent: rgb(0.12, 0.37, 0.6),
    band: rgb(0.9, 0.94, 0.97),
    line: rgb(0.8, 0.84, 0.88),
    white: rgb(1, 1, 1),
    field: rgb(0.97, 0.98, 1),
  };

  // Helvetica only supports WinAnsi; replace anything it can't encode.
  function safe(font, text) {
    let out = "";
    for (const ch of String(text)) {
      if (ch === "\n") { out += ch; continue; }
      const mapped = { "✓": "v", "→": "->", "≤": "<=", "≥": ">=", "\t": " " }[ch];
      if (mapped) { out += mapped; continue; }
      try { font.encodeText(ch); out += ch; } catch (_) { out += "?"; }
    }
    return out;
  }

  function wrap(font, text, size, maxW) {
    const lines = [];
    for (const para of safe(font, text).split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (font.widthOfTextAtSize(test, size) <= maxW) { line = test; continue; }
        if (line) lines.push(line);
        // hard-break very long words
        let word = w;
        while (font.widthOfTextAtSize(word, size) > maxW) {
          let i = word.length;
          while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > maxW) i--;
          lines.push(word.slice(0, i));
          word = word.slice(i);
        }
        line = word;
      }
      lines.push(line);
    }
    return lines.length ? lines : [""];
  }

  function slug(s) {
    return String(s).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "x";
  }

  async function build({ info, selections, sections }) {
    const doc = await PDFDocument.create();
    doc.setTitle("Site Photo Checklist" + (info.site ? " - " + info.site : ""));
    doc.setSubject("Site photo checklist");
    doc.setCreator("Site Photo Checklist Builder");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const form = doc.getForm();

    let page, y;
    const pages = [];
    const newPage = () => {
      page = doc.addPage([PAGE_W, PAGE_H]);
      pages.push(page);
      y = PAGE_H - M;
    };
    const ensure = (h) => { if (y - h < M + FOOTER_H) { newPage(); return true; } return false; };

    const text = (str, x, yy, { f = font, size = FS, color = C.ink } = {}) =>
      page.drawText(safe(f, str), { x, y: yy, size, font: f, color });

    const textField = (name, x, yy, w, h, value, { multiline = false, size = FS } = {}) => {
      const tf = form.createTextField(name);
      if (multiline) tf.enableMultiline();
      if (value) tf.setText(safe(font, value));
      tf.addToPage(page, { x, y: yy, width: w, height: h, font, borderColor: C.line, backgroundColor: C.field, borderWidth: 0.75 });
      tf.setFontSize(size);
      return tf;
    };

    const checkBox = (name, x, yy, s) => {
      const cb = form.createCheckBox(name);
      cb.addToPage(page, { x, y: yy, width: s, height: s, borderColor: C.ink, backgroundColor: C.white, borderWidth: 0.9, textColor: C.ink });
      return cb;
    };

    /* ---------------- Page 1 header ---------------- */
    newPage();
    text("Site Photo Checklist", M, y - 18, { f: bold, size: 18 });
    y -= 30;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1.5, color: C.accent });
    y -= 14;

    const labelField = (label, name, x, w, value) => {
      text(label, x, y, { f: bold, size: 8, color: C.muted });
      textField(name, x, y - 22, w, 18, value, { size: 10 });
    };
    const half = (CONTENT_W - 12) / 2;
    labelField("SITE NAME", "Site_Name", M, half, info.site);
    labelField("SITE ID / JOB #", "Site_ID", M + half + 12, half, info.siteId);
    y -= 34;
    labelField("ADDRESS", "Address", M, CONTENT_W, info.address);
    y -= 34;
    labelField("TECHNICIAN", "Technician", M, half, info.tech);
    labelField("DATE", "Date", M + half + 12, half, info.date);
    y -= 40;

    // Configuration summary (static text – reflects what was picked in the app)
    text("SITE CONFIGURATION", M, y, { f: bold, size: 8, color: C.muted });
    y -= 6;
    const labW = 150;
    for (const s of selections) {
      const val = s.values.length ? s.values.join(", ") : "None selected";
      const lines = wrap(font, val, FS, CONTENT_W - labW - 10);
      const h = lines.length * LH + 6;
      ensure(h);
      page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.5, color: C.line });
      text(s.category, M + 4, y - LH, { f: bold });
      lines.forEach((ln, i) => text(ln, M + labW, y - LH - i * LH, { color: s.values.length ? C.ink : C.muted }));
      y -= h;
    }
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.5, color: C.line });
    y -= 18;

    /* ---------------- Item tables ---------------- */
    const total = sections.reduce((n, s) => n + s.items.length, 0);
    text(`Mark each item Done (or N/A) once its photo has been taken. ${total} items.`, M, y, { size: 8.5, color: C.muted });
    y -= 14;

    const colHeader = () => {
      const h = 14;
      text("#", M + 4, y - 10, { f: bold, size: 7.5, color: C.muted });
      text("ITEM", M + COL_NUM, y - 10, { f: bold, size: 7.5, color: C.muted });
      const xc = M + COL_NUM + COL_ITEM;
      text("DONE", xc + 6, y - 10, { f: bold, size: 7.5, color: C.muted });
      text("N/A", xc + COL_CHECK + 7, y - 10, { f: bold, size: 7.5, color: C.muted });
      text("NOTES", xc + COL_CHECK + COL_NA + 4, y - 10, { f: bold, size: 7.5, color: C.muted });
      y -= h;
    };

    const sectionBand = (sec, cont) => {
      const h = 20;
      page.drawRectangle({ x: M, y: y - h, width: CONTENT_W, height: h, color: C.band });
      page.drawRectangle({ x: M, y: y - h, width: 3, height: h, color: C.accent });
      const title = sec.title + (cont ? " (continued)" : "");
      text(title, M + 9, y - 14, { f: bold, size: 11, color: C.accent });
      const tw = bold.widthOfTextAtSize(safe(bold, title), 11);
      text(sec.category + "  |  " + sec.items.length + " items", M + 9 + tw + 10, y - 14, { size: 8, color: C.muted });
      y -= h;
      colHeader();
    };

    let n = 0;
    sections.forEach((sec, si) => {
      const sid = String(si + 1).padStart(2, "0") + "_" + slug(sec.title);
      // keep the band with at least the first row
      if (ensure(20 + 14 + 24)) { /* new page */ }
      sectionBand(sec, false);

      sec.items.forEach((item, ii) => {
        n++;
        const lines = wrap(font, item, FS, COL_ITEM - 8);
        const rowH = Math.max(lines.length * LH + PAD * 2, 22);
        if (ensure(rowH)) sectionBand(sec, true);

        const top = y;
        if (ii % 2 === 1) page.drawRectangle({ x: M, y: top - rowH, width: CONTENT_W, height: rowH, color: rgb(0.985, 0.988, 0.992) });
        text(String(ii + 1), M + 4, top - PAD - FS + 1, { size: 8, color: C.muted });
        lines.forEach((ln, i) => text(ln, M + COL_NUM, top - PAD - FS + 1 - i * LH));

        const fid = "S" + sid + "_I" + String(ii + 1).padStart(2, "0");
        const box = 12;
        const xc = M + COL_NUM + COL_ITEM;
        const cy = top - rowH / 2 - box / 2;
        checkBox(fid + "_Done", xc + (COL_CHECK - box) / 2, cy, box);
        checkBox(fid + "_NA", xc + COL_CHECK + (COL_NA - box) / 2, cy, box);
        const nh = rowH - 6;
        textField(fid + "_Notes", xc + COL_CHECK + COL_NA + 2, top - 3 - nh, COL_NOTES - 2, nh, "", { multiline: nh > 20, size: 8 });

        y -= rowH;
        page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.4, color: C.line });
      });
      y -= 14;
    });

    /* ---------------- Sign-off ---------------- */
    ensure(190);
    text("GENERAL NOTES", M, y, { f: bold, size: 8, color: C.muted });
    textField("General_Notes", M, y - 96, CONTENT_W, 90, "", { multiline: true, size: 9 });
    y -= 116;
    const third = (CONTENT_W - 24) / 3;
    const so = (label, name, x, w, val) => {
      text(label, x, y, { f: bold, size: 8, color: C.muted });
      textField(name, x, y - 24, w, 20, val, { size: 10 });
    };
    so("COMPLETED BY", "Completed_By", M, third, info.tech);
    so("SIGNATURE", "Signature", M + third + 12, third, "");
    so("DATE COMPLETED", "Date_Completed", M + 2 * (third + 12), third, "");
    y -= 34;

    /* ---------------- Footers ---------------- */
    const footLeft = safe(font, ["Site Photo Checklist", info.siteId || info.site].filter(Boolean).join("  |  "));
    pages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: M + 10 }, end: { x: PAGE_W - M, y: M + 10 }, thickness: 0.5, color: C.line });
      p.drawText(footLeft, { x: M, y: M, size: 7.5, font, color: C.muted });
      const r = `Page ${i + 1} of ${pages.length}`;
      p.drawText(r, { x: PAGE_W - M - font.widthOfTextAtSize(r, 7.5), y: M, size: 7.5, font, color: C.muted });
    });

    form.updateFieldAppearances(font);
    return doc.save();
  }

  window.ChecklistPDF = { build };
})();
