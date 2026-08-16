/*
 * Zotero Glossary — selection popup.
 *
 * A small floating card shown near the selected term. It queries the LLM,
 * renders the explanation (EN + ZH), and offers "favorite" (收藏) to add the
 * term to the glossary book.
 */
"use strict";

/* global ZG, Zotero */

ZG.popup = (() => {
  const WIDTH = 380;
  let _root = null;
  let _current = null; // { term, context, source }

  function ensureRoot() {
    if (_root && _root.isConnected) return _root;
    const d = ZG.ui.doc();
    if (!d) return null;
    _root = ZG.ui.el("div", "zg-root");
    _root.style.width = WIDTH + "px";
    _root.style.display = "none";
    // Zotero's main window is XUL: there is no <body>, so append to the
    // root element (window) instead.
    const container = d.body || d.documentElement;
    if (!container) return null;
    container.appendChild(_root);

    // Hide when clicking outside the popup.
    d.addEventListener("mousedown", (e) => {
      if (_root && _root.isConnected && !_root.contains(e.target)) {
        hide();
      }
    }, true);
    // Escape hides the popup.
    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hide();
    }, true);
    return _root;
  }

  /** Abort any in-flight lookup (no-op marker; AbortController is unavailable
   *  in Zotero 9's plugin sandbox). */
  function cancelCurrent() {
    _current = null;
  }

  function hide() {
    cancelCurrent();
    if (_root) {
      _root.style.display = "none";
      _root.textContent = "";
    }
  }

  // ── click-to-query trigger ("专业名词查询" chip near the selection) ──────
  // The chip is inserted into the SAME document as the selection (the PDF
  // reader's HTML document, or the main window), so its coordinates are
  // naturally correct — no cross-window conversion is needed.

  const TRIGGER_CSS =
    "position:fixed;z-index:2147483000;padding:6px 14px;border-radius:20px;" +
    "font:12px 'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;" +
    "background:#ffffff;border:1px solid #c9c9cf;color:#1b1b1f;" +
    "box-shadow:0 2px 10px rgba(0,0,0,.18);cursor:pointer;user-select:none;" +
    "display:none;white-space:nowrap;";

  function hideTriggerInDoc(doc) {
    if (!doc) return;
    const el = doc.getElementById("zg-trigger-root");
    if (el) el.style.display = "none";
  }

  /**
   * Show the chip in `opts.doc` near the selection.
   *  - opts.x / opts.y: chip position in the document's coordinates.
   *  - opts.mainX / opts.mainY: main-window coordinates used when the query
   *    card (which lives in the main window) opens after a click.
   */
  function showTriggerInDoc(opts) {
    const term = String(opts.term || "").trim();
    if (!term) return;
    const doc = opts.doc;
    if (!doc) return;
    hide(); // hide any old query card

    let root = doc.getElementById("zg-trigger-root");
    if (!root) {
      // HTML documents (PDF reader): plain createElement. XUL main window:
      // must use createElementNS + the shared stylesheet.
      if (doc.body) {
        root = doc.createElement("div");
        root.style.cssText = TRIGGER_CSS;
        doc.body.appendChild(root);
      } else {
        root = ZG.ui.el("div", "zg-root zg-trigger");
        (doc.body || doc.documentElement).appendChild(root);
      }
      root.id = "zg-trigger-root";

      // Hide when clicking anywhere else in this document.
      doc.addEventListener("mousedown", (e) => {
        if (root.isConnected && !root.contains(e.target)) hideTriggerInDoc(doc);
      }, true);

      // Clicking the chip runs the query (card appears in the main window).
      root.addEventListener("click", () => {
        const t = root.dataset.zgTerm || "";
        const x = Number(root.dataset.zgMainX) || 100;
        const y = Number(root.dataset.zgMainY) || 100;
        hideTriggerInDoc(doc);
        if (t) show({ term: t, x, y });
      });
    }

    root.dataset.zgTerm = term;
    root.textContent = "🔍 专业名词查询";
    root.title = "点击查询：" + term;
    let x = Number(opts.x) || 100;
    let y = Number(opts.y) || 100;
    root.style.left = (x + 8) + "px";
    root.style.top = (y + 8) + "px";
    root.dataset.zgMainX = Number(opts.mainX) || x;
    root.dataset.zgMainY = Number(opts.mainY) || y;
    root.style.display = "block";
  }

  /** Backward-compatible alias used by the main window path. */
  function showTrigger(opts) {
    showTriggerInDoc({
      term: opts.term,
      doc: ZG.ui.doc(),
      x: opts.x,
      y: opts.y,
      mainX: opts.x,
      mainY: opts.y,
      context: opts.context,
    });
  }

  function hideTrigger() {
    hideTriggerInDoc(ZG.ui.doc());
  }

  /**
   * Show the lookup popup for a selected term.
   * @param {object} opts { term, context, x, y, source, auto }
   */
  async function show(opts) {
    const term = String(opts.term || "").trim();
    Zotero.debug(`[Zotero Glossary] popup.show: "${term}"`);
    if (!term) return;

    const root = ensureRoot();
    if (!root) {
      Zotero.debug("[Zotero Glossary] popup.show: no root element (main window not ready?)", 2);
      return;
    }

    cancelCurrent();
    _current = {
      term,
      context: opts.context || "",
      source: opts.source || "",
    };

    // Reposition: place below-right of the cursor, clamped to the viewport.
    const vw = root.ownerDocument.defaultView;
    let x = (opts.x || 0) + 12;
    let y = (opts.y || 0) + 12;
    if (x + WIDTH > vw.innerWidth - 8) x = vw.innerWidth - WIDTH - 8;
    if (x < 8) x = 8;
    root.style.left = x + "px";
    root.style.top = y + "px";
    root.style.display = "block";

    renderLoading(term);
    try {
      const entry = await ZG.llm.lookup(term, opts.context);
      if (_current && _current.term === term) {
        try {
          await renderResult(term, entry);
        } catch (e2) {
          Zotero.debug(`[Zotero Glossary] renderResult: ${e2}`, 2);
        }
      }
    } catch (e) {
      if (_current && _current.term === term) {
        renderError(term, e);
      }
    }
  }

  function renderLoading(term) {
    const root = ensureRoot();
    root.textContent = "";
    const header = ZG.ui.el("div", "zg-header");
    header.appendChild(ZG.ui.el("span", "zg-term", term));
    header.appendChild(ZG.ui.el("span", "zg-badge", "查询中…"));
    header.appendChild(closeBtn());
    root.appendChild(header);

    const body = ZG.ui.el("div", "zg-body");
    const loading = ZG.ui.el("div", "zg-loading");
    loading.appendChild(ZG.ui.el("span", "zg-spinner"));
    loading.appendChild(ZG.ui.el("span", "zg-text", "正在向大模型查询术语解释…"));
    body.appendChild(loading);
    root.appendChild(body);
  }

  function renderError(term, err) {
    const root = ensureRoot();
    root.textContent = "";
    const header = ZG.ui.el("div", "zg-header");
    header.appendChild(ZG.ui.el("span", "zg-term", term));
    header.appendChild(ZG.ui.el("span", "zg-badge", "查询失败"));
    header.appendChild(closeBtn());
    root.appendChild(header);

    const body = ZG.ui.el("div", "zg-body");
    const msg = ZG.ui.el("div", "zg-error");
    msg.textContent = err && err.message ? err.message : String(err);
    body.appendChild(msg);

    const footer = ZG.ui.el("div", "zg-footer");
    if (err && err.code === "NO_API_KEY") {
      const hint = ZG.ui.el("span", "zg-muted", "请先在 设置 → Glossary 中配置 API Key：");
      const open = ZG.ui.btn("打开设置", "zg-btn-primary", () => {
        ZG.settings.openPane();
        hide();
      });
      footer.appendChild(hint);
      footer.appendChild(open);
    } else {
      const retry = ZG.ui.btn("重试", "zg-btn-primary", () => {
        const cur = _current;
        hide();
        if (cur) show(cur);
      });
      footer.appendChild(retry);
    }
    root.appendChild(footer);
  }

  async function renderResult(term, entry) {
    const root = ensureRoot();
    root.textContent = "";

    // Book selector: which glossary book to favorite into.
    const books = await ZG.glossary.listBooks();
    const lastBook =
      (ZG.prefs.get("lastBook") && books.includes(ZG.prefs.get("lastBook")))
        ? ZG.prefs.get("lastBook")
        : (books[0] || "默认名词本");
    let curBook = lastBook;
    let fav = await ZG.glossary.find(term, curBook);
    let isFav = !!fav;

    const header = ZG.ui.el("div", "zg-header");
    header.appendChild(ZG.ui.el("span", "zg-term", entry.term || term));
    if (entry.category) header.appendChild(ZG.ui.el("span", "zg-badge", entry.category));
    header.appendChild(closeBtn());
    root.appendChild(header);

    const body = ZG.ui.el("div", "zg-body");
    if (entry.zh) {
      body.appendChild(section("中文解释", ZG.ui.el("div", "zg-text", entry.zh)));
    }
    if (entry.en) {
      body.appendChild(section("English", ZG.ui.el("div", "zg-text", entry.en)));
    }
    if (entry.example) {
      body.appendChild(section("例句", ZG.ui.el("div", "zg-text zg-example", entry.example)));
    }
    root.appendChild(body);

    const footer = ZG.ui.el("div", "zg-footer");

    // "收藏到" label + book dropdown.
    const favLabel = ZG.ui.el("span", "zg-muted", "收藏到");
    const bookSel = ZG.ui.el("select", "zg-book-sel");
    for (const b of books) {
      const opt = ZG.ui.el("option", "", b);
      opt.value = b;
      bookSel.appendChild(opt);
    }
    bookSel.value = curBook;
    bookSel.addEventListener("change", async () => {
      curBook = bookSel.value;
      fav = await ZG.glossary.find(term, curBook);
      isFav = !!fav;
      favBtn.textContent = isFav ? "✓ 已收藏" : "☆ 收藏";
      favBtn.classList.toggle("zg-btn-primary", !isFav);
    });

    const favBtn = ZG.ui.btn(
      isFav ? "✓ 已收藏" : "☆ 收藏",
      isFav ? "" : "zg-btn-primary",
      async () => {
        if (await ZG.glossary.toggleFav(term, curBook)) {
          await ZG.glossary.upsert({
            term,
            book: curBook,
            zh: entry.zh,
            en: entry.en,
            category: entry.category,
            example: entry.example,
            source: _current ? _current.source : "",
          });
          ZG.prefs.set("lastBook", curBook);
          favBtn.textContent = "✓ 已收藏";
          favBtn.classList.remove("zg-btn-primary");
        } else {
          favBtn.textContent = "☆ 收藏";
          favBtn.classList.add("zg-btn-primary");
        }
      }
    );
    const bookBtn = ZG.ui.btn("名词本", () => {
      ZG.glossaryPane.open();
      hide();
    });
    footer.appendChild(favLabel);
    footer.appendChild(bookSel);
    footer.appendChild(favBtn);
    footer.appendChild(bookBtn);
    root.appendChild(footer);
  }

  function section(label, contentNode) {
    const wrap = ZG.ui.el("div", "zg-section");
    wrap.appendChild(ZG.ui.el("div", "zg-label", label));
    wrap.appendChild(contentNode);
    return wrap;
  }

  function closeBtn() {
    const b = ZG.ui.el("button", "zg-close", "✕");
    b.title = "关闭";
    b.addEventListener("click", hide);
    return b;
  }

  return { show, hide, showTrigger, hideTrigger, showTriggerInDoc, hideTriggerInDoc };
})();
