/*
 * Zotero Glossary — selection capture.
 *
 * 1. Main window (item notes, webpages): mouseup on the main document.
 * 2. PDF/EPub readers: uses Zotero's official Reader event
 *    "renderTextSelectionPopup" (fires when the user selects text in a
 *    reader and Zotero renders its selection popup), which provides the
 *    selected text via params.annotation.text — the same mechanism used by
 *    Zotero-pdf-translate. No iframe scanning needed.
 */
"use strict";

/* global ZG, Zotero */

ZG.selection = (() => {
  const PLUGIN_ID = "glossary@zotero.local";
  const TERM_RE = /[A-Za-z\u00C0-\u024F]|[\u4e00-\u9fff]/; // latin or CJK
  const ATTACHED = new WeakSet(); // main-window documents already wired
  let _timer = null; // debounce
  let _scanTimer = null;
  let _lastShown = { term: "", t: 0 }; // avoid re-opening the same term
  let _unregisterReader = null;

  // ── main window (notes / webpages) ────────────────────────────────────────

  function attachMainWindow() {
    const win = Zotero.getMainWindow();
    if (!win || !win.document) return;
    if (ATTACHED.has(win.document)) return;
    ATTACHED.add(win.document);
    const doc = win.document;

    doc.addEventListener("mouseup", (e) => {
      const sel = win.getSelection();
      maybeShow(sel, e.clientX, e.clientY, "", win);
    });

    // NOTE: no global main-window mousedown handler here. Hiding the chip on
    // "click elsewhere" is handled by the follow loop, which detects that
    // Zotero's selection popup was removed. A main-window capture-phase
    // mousedown listener would run BEFORE the chip's own mousedown (capture
    // phase descends document -> target) and hide the chip, swallowing the
    // click that should start the query.

    doc.addEventListener("keyup", (e) => {
      if (e.key === "Escape") {
        ZG.popup.hide();
        ZG.popup.hideTrigger();
      }
    });
  }

  // ── readers (PDF/EPub) — official Zotero Reader event ─────────────────────

  function registerReaderSelection() {
    try {
      if (typeof Zotero.Reader.registerEventListener === "function") {
        _unregisterReader = Zotero.Reader.registerEventListener(
          "renderTextSelectionPopup",
          onTextSelectionPopup,
          PLUGIN_ID
        );
        Zotero.debug("[Zotero Glossary] registered renderTextSelectionPopup listener");
      } else {
        Zotero.debug("[Zotero Glossary] Zotero.Reader.registerEventListener unavailable", 2);
      }
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] registerReaderSelection: ${e}`, 2);
    }
  }

  /** Fired by Zotero when text is selected in a reader. Shows the
   *  click-to-query chip just BELOW Zotero's selection popup (never inside
   *  it, so it cannot overlap the translation plugin's box). A read-only
   *  follow loop keeps the chip below the popup and hides it when the popup
   *  closes. No document listeners or observers are installed, so other
   *  plugins (e.g. the translation add-on) are never affected. */
  function onTextSelectionPopup(event) {
    try {
      const { reader, doc, params } = event;
      const raw = params && params.annotation ? params.annotation.text : "";
      const text = String(raw || "").trim().replace(/\s+/g, " ");
      Zotero.debug(`[Zotero Glossary] renderTextSelectionPopup: "${text.slice(0, 40)}"`);

      const p = ZG.prefs;
      if (!p.get("popupEnabled")) return;
      const minLen = Number(p.get("minSelectionLength")) || 2;
      const maxLen = Number(p.get("maxSelectionLength")) || 80;
      if (!isValidTerm(text, minLen, maxLen)) return;

      // Wait a tick so Zotero has rendered its selection popup (and the
      // translation plugin has appended its content), then anchor the chip
      // below it. If the popup is already gone (fast deselect), show nothing.
      setTimeout(() => {
        try {
          let popup = null;
          try {
            popup = doc ? doc.querySelector(".selection-popup") : null;
          } catch (e) {
            popup = null;
          }
          if (!popup) {
            Zotero.debug("[Zotero Glossary] skip chip: selection popup gone");
            return;
          }
          ZG.popup.showTriggerBelow({ term: text, doc, popup });
        } catch (e) {
          Zotero.debug(`[Zotero Glossary] showTriggerBelow: ${e}`, 2);
        }
      }, 120);
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] onTextSelectionPopup: ${e}`, 2);
    }
  }

  // ── shared logic ───────────────────────────────────────────────────────────

  function termText(sel) {
    if (!sel || sel.isCollapsed) return "";
    const raw = String(sel.toString() || "").trim();
    return raw.replace(/\s+/g, " ").trim();
  }

  function isValidTerm(text, minLen, maxLen) {
    if (!text || text.length < minLen || text.length > maxLen) return false;
    if (!TERM_RE.test(text)) return false;
    // Skip pure numbers / punctuation.
    if (/^[\d\s.,;:!?()\[\]{}\-—–"'’‘“”]+$/.test(text)) return false;
    return true;
  }

  /** Best-effort surrounding sentence for context. */
  function extractContext(doc, sel) {
    try {
      if (!sel || !sel.anchorNode) return "";
      let node = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode : null;
      let block = node ? node.parentElement : sel.anchorNode.parentElement;
      while (block && block.parentElement && block.parentElement !== doc.body) {
        block = block.parentElement;
      }
      const text = block ? String(block.textContent || "").replace(/\s+/g, " ").trim() : "";
      const idx = text.indexOf(sel.toString().trim());
      if (idx < 0) return text.slice(0, 400);
      const start = Math.max(0, idx - 120);
      return text.slice(start, idx + sel.toString().length + 220);
    } catch (_) {
      return "";
    }
  }

  function maybeShow(sel, x, y, source, win) {
    const p = ZG.prefs;
    if (!p.get("popupEnabled")) return;

    const text = termText(sel);
    const minLen = Number(p.get("minSelectionLength")) || 2;
    const maxLen = Number(p.get("maxSelectionLength")) || 80;
    if (!isValidTerm(text, minLen, maxLen)) return;

    // Don't re-open for the same term within a short window.
    const now = Date.now();
    if (_lastShown.term === text.toLowerCase() && now - _lastShown.t < 1500) return;
    _lastShown = { term: text.toLowerCase(), t: now };

    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(() => {
      // Selection may already be cleared (fast deselect) — then skip.
      try {
        const s = win && win.getSelection ? win.getSelection() : null;
        if (!s || s.isCollapsed || !String(s.toString() || "").trim()) return;
      } catch (e) {
        /* ignore */
      }
      const doc = win ? win.document : null;
      const context = doc && sel ? extractContext(doc, sel) : "";
      // Click-to-query: only show the chip; query starts on click.
      ZG.popup.showTrigger({ term: text, x, y, context });
    }, 280);
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  function start() {
    attachMainWindow();
    registerReaderSelection();

    // Periodic re-attach for the main window (Zotero windows can reopen).
    _scanTimer = setInterval(() => {
      attachMainWindow();
    }, 3000);

    try {
      if (typeof Zotero.addListener === "function") {
        Zotero.addListener("windowActivate", attachMainWindow);
      }
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] windowActivate hook: ${e}`, 2);
    }
  }

  function stop() {
    if (_timer) clearTimeout(_timer);
    if (_scanTimer) clearInterval(_scanTimer);
    _timer = null;
    _scanTimer = null;
    try {
      if (_unregisterReader && typeof _unregisterReader === "function") {
        _unregisterReader();
      }
    } catch (e) {
      /* ignore */
    }
    try {
      if (typeof Zotero.removeListener === "function") {
        Zotero.removeListener("windowActivate", attachMainWindow);
      }
    } catch (e) {
      /* ignore */
    }
  }

  return { start, stop };
})();
