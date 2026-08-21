/*
 * Zotero Glossary — shared UI helpers.
 *
 * All addon UI lives inside the main Zotero window as absolutely-positioned
 * elements (no chrome:// resources needed, no separate windows).
 */
"use strict";

/* global ZG, Zotero, Services */

ZG.ui = (() => {
  let _doc = null; // main window document

  // Only the header/footer bars use the fixed beige palette; everything else
  // follows the Zotero theme variables for native contrast.
  const STYLE = `
    .zg-root {
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 13px;
      line-height: 1.55;
      color: var(--fill-primary, #1b1b1f);
      box-sizing: border-box;
      position: fixed;
      z-index: 2147483000;
      background: var(--fill-window, #ffffff);
      border: 1px solid var(--fill-quaternary, #c9c9cf);
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
      overflow: hidden;
    }
    .zg-root * { box-sizing: border-box; }
    .zg-root .zg-header {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px;
      background: #f3ebd7;
      border-bottom: 1px solid #e0d5b5;
      font-weight: 600;
    }
    .zg-root .zg-term {
      font-weight: 700; font-size: 14px;
      color: var(--color-accent, #0060df);
      overflow-wrap: anywhere;
    }
    .zg-root .zg-badge {
      font-size: 11px; color: var(--fill-primary, #666);
      background: var(--fill-quinary, #e9e9ef);
      border-radius: 4px; padding: 1px 6px; margin-left: 4px;
    }
    .zg-root .zg-body { padding: 10px 12px; max-height: 60vh; overflow: auto; }
    .zg-root .zg-section { margin-bottom: 8px; }
    .zg-root .zg-label {
      font-size: 11px; font-weight: 700; color: var(--fill-tertiary, #8a8a92);
      text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 2px;
    }
    .zg-root .zg-text { overflow-wrap: anywhere; white-space: pre-wrap; }
    .zg-root .zg-example { font-style: italic; color: var(--fill-primary, #444); }
    .zg-root .zg-footer {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px;
      border-top: 1px solid #e0d5b5;
      background: #f6efdd;
    }
    .zg-root .zg-btn {
      border: 1px solid var(--fill-quaternary, #c9c9cf);
      background: var(--fill-window, #ffffff);
      color: var(--fill-primary, #1b1b1f);
      border-radius: 6px; padding: 4px 12px; cursor: pointer;
      font-size: 12px;
    }
    .zg-root .zg-btn:hover { background: var(--fill-quinary, #ececf2); }
    .zg-root .zg-btn-primary {
      background: var(--color-accent, #0060df);
      border-color: var(--color-accent, #0060df);
      color: #ffffff;
    }
    .zg-root .zg-btn-primary:hover { background: var(--color-accent-hover, #0250bb); }
    .zg-root .zg-btn-danger:hover { background: #d70022; border-color: #d70022; color: #fff; }
    .zg-root .zg-close {
      margin-left: auto; cursor: pointer; font-size: 14px; color: var(--fill-tertiary, #888);
      border: none; background: none; padding: 0 4px; line-height: 1;
    }
    .zg-root .zg-close:hover { color: var(--fill-primary, #222); }
    .zg-root .zg-loading { color: var(--fill-tertiary, #777); display: flex; gap: 8px; align-items: center; }
    .zg-root .zg-spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid var(--fill-quaternary, #d0d0d6);
      border-top-color: var(--color-accent, #0060df);
      animation: zg-spin 0.8s linear infinite;
    }
    @keyframes zg-spin { to { transform: rotate(360deg); } }
    .zg-root .zg-error { color: #d70022; white-space: pre-wrap; overflow-wrap: anywhere; }
    .zg-root .zg-muted { color: var(--fill-tertiary, #8a8a92); font-size: 12px; }
    .zg-root .zg-empty { color: var(--fill-tertiary, #8a8a92); text-align: center; padding: 24px 12px; }
    .zg-root .zg-search {
      width: 100%; padding: 6px 10px; border: 1px solid var(--fill-quaternary, #c9c9cf);
      border-radius: 6px; font-size: 13px; background: var(--fill-window, #fff);
      color: var(--fill-primary, #1b1b1f);
    }
    .zg-root select.zg-book-sel {
      border: 1px solid var(--fill-quaternary, #c9c9cf);
      border-radius: 6px; padding: 3px 6px; font-size: 12px;
      background: var(--fill-window, #fff); color: var(--fill-primary, #1b1b1f);
      max-width: 160px;
    }
    .zg-root .zg-inline-row {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--fill-quaternary, #e0e0e6);
      background: var(--fill-quinary, #f5f5f8);
    }
    .zg-root .zg-inline-row .zg-search { flex: 1; }
    .zg-root.zg-trigger {
      width: auto;
      padding: 6px 14px;
      cursor: pointer;
      border-radius: 20px;
      font-size: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
      user-select: none;
    }
    .zg-root.zg-trigger:hover {
      background: var(--fill-quinary, #ececf2);
      border-color: var(--color-accent, #0060df);
    }
    .zg-root .zg-list { max-height: 50vh; overflow: auto; }
    .zg-root .zg-item {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 8px 10px; border-bottom: 1px solid var(--fill-quinary, #eee);
    }
    .zg-root .zg-item:hover { background: var(--fill-quinary, #f2f2f6); }
    .zg-root .zg-item-main { flex: 1; min-width: 0; }
    .zg-root .zg-item-term { font-weight: 700; overflow-wrap: anywhere; }
    .zg-root .zg-item-zh { color: var(--fill-primary, #444); overflow-wrap: anywhere; }
    .zg-root .zg-item-meta { font-size: 11px; color: var(--fill-tertiary, #999); }
  `;

  function doc() {
    if (!_doc || _doc.defaultView !== Zotero.getMainWindow()) {
      const win = Zotero.getMainWindow();
      if (!win) return null;
      _doc = win.document;
      injectStyle();
    }
    return _doc;
  }

  function injectStyle() {
    if (!_doc) return;
    try {
      if (_doc.getElementById("zotero-glossary-style")) return;
      const style = _doc.createElementNS(XHTML_NS, "style");
      style.id = "zotero-glossary-style";
      style.textContent = STYLE;
      (_doc.head || _doc.documentElement).appendChild(style);
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] injectStyle: ${e}`, 2);
    }
  }

  const XHTML_NS = "http://www.w3.org/1999/xhtml";

  /** Create an HTML-namespace element (Zotero's main window is XUL, so a
   *  plain createElement would create XUL elements). */
  function el(tag, cls, text) {
    const d = doc();
    let node = null;
    try {
      node = d.createElementNS(XHTML_NS, tag);
    } catch (e) {
      node = d.createElement(tag);
    }
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /** Create a button. */
  function btn(text, cls, onClick) {
    const b = el("button", "zg-btn" + (cls ? " " + cls : ""), text);
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  return { doc, injectStyle, el, btn };
})();
