/*
 * Zotero Glossary — glossary books panel.
 *
 * A floating panel with:
 *  - book selector (switch / create / rename / delete glossary books),
 *  - search box,
 *  - entry list for the current book with copy / delete actions.
 */
"use strict";

/* global ZG, Zotero, Services */

ZG.glossaryPane = (() => {
  let _root = null;
  let _search = null;
  let _list = null;
  let _bookSel = null;
  let _status = null;
  let _currentBook = "";

  function ensureRoot() {
    if (_root && _root.isConnected) return _root;
    const d = ZG.ui.doc();
    if (!d) return null;
    _root = ZG.ui.el("div", "zg-root");
    _root.style.width = "560px";
    _root.style.display = "none";
    // Zotero's main window is XUL: no <body>, append to the root element.
    const container = d.body || d.documentElement;
    if (!container) return null;
    container.appendChild(_root);

    d.addEventListener("mousedown", (e) => {
      if (_root && _root.isConnected && !_root.contains(e.target)) close();
    }, true);
    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    }, true);
    return _root;
  }

  function open() {
    const root = ensureRoot();
    if (!root) return;
    const vw = root.ownerDocument.defaultView;
    const w = 560;
    const x = Math.max(8, vw.innerWidth - w - 16);
    const y = 64;
    root.style.left = x + "px";
    root.style.top = y + "px";
    root.style.display = "block";
    render();
  }

  function close() {
    if (_root) {
      _root.style.display = "none";
      _root.textContent = "";
    }
  }

  function toggle() {
    if (_root && _root.style.display === "block") close();
    else open();
  }

  function setStatus(text, isErr) {
    if (!_status) return;
    _status.textContent = text;
    _status.style.color = isErr ? "#d70022" : text.startsWith("✓") ? "#0a8f2c" : "";
  }

  // ── render ────────────────────────────────────────────────────────────────

  async function render() {
    const root = ensureRoot();
    if (!root) return;
    root.textContent = "";

    const header = ZG.ui.el("div", "zg-header");
    header.appendChild(ZG.ui.el("span", "zg-term", "专业名词本"));

    const books = await ZG.glossary.listBooks();
    if (!_currentBook || !books.includes(_currentBook)) {
      _currentBook = books[0] || "默认名词本";
    }

    _bookSel = ZG.ui.el("select", "zg-book-sel");
    for (const b of books) {
      const opt = ZG.ui.el("option", "", b);
      opt.value = b;
      _bookSel.appendChild(opt);
    }
    _bookSel.value = _currentBook;
    _bookSel.addEventListener("change", async () => {
      _currentBook = _bookSel.value;
      await renderList();
    });
    header.appendChild(_bookSel);

    const addBtn = ZG.ui.btn("＋", "", () => startCreateBook());
    addBtn.title = "新建名词本";
    header.appendChild(addBtn);
    const renBtn = ZG.ui.btn("✎", "", () => startRenameBook());
    renBtn.title = "重命名当前名词本";
    header.appendChild(renBtn);
    const delBtn = ZG.ui.btn("🗑", "zg-btn-danger", () => deleteCurrentBook());
    delBtn.title = "删除当前名词本（默认名词本不可删除）";
    header.appendChild(delBtn);

    const closeBtnEl = ZG.ui.el("button", "zg-close", "✕");
    closeBtnEl.title = "关闭";
    closeBtnEl.addEventListener("click", close);
    header.appendChild(closeBtnEl);
    root.appendChild(header);

    const body = ZG.ui.el("div", "zg-body");
    _search = ZG.ui.el("input", "zg-search");
    _search.placeholder = "搜索名词（支持中英文）…";
    _search.addEventListener("input", renderList);
    body.appendChild(_search);

    _status = ZG.ui.el("div", "zg-muted");
    _status.style.padding = "4px 2px";
    body.appendChild(_status);

    _list = ZG.ui.el("div", "zg-list");
    body.appendChild(_list);
    root.appendChild(body);

    await renderList();
  }

  // ── book management ───────────────────────────────────────────────────────

  function startCreateBook() {
    showInlineInput("新建名词本名称", async (name) => {
      const n = await ZG.glossary.createBook(name);
      if (n) {
        _currentBook = n;
        await render();
      } else {
        setStatus("✗ 名称无效", true);
      }
    });
  }

  function startRenameBook() {
    showInlineInput("重命名「" + _currentBook + "」为", async (name) => {
      const n = await ZG.glossary.renameBook(_currentBook, name);
      if (n) {
        _currentBook = n;
        await render();
      } else {
        setStatus("✗ 重命名失败", true);
      }
    });
  }

  async function deleteCurrentBook() {
    if (!_currentBook || _currentBook === "默认名词本") {
      setStatus("默认名词本不可删除", true);
      return;
    }
    let ok = false;
    try {
      ok = Services.prompt.confirm(
        ZG.ui.doc().defaultView,
        "删除名词本",
        "确定删除名词本「" + _currentBook + "」？其中的条目也会被删除。"
      );
    } catch (e) {
      ok = true; // no confirm API: proceed
    }
    if (!ok) return;
    const del = await ZG.glossary.deleteBook(_currentBook);
    if (del) {
      _currentBook = "";
      await render();
    }
  }

  /** Inline one-shot input row for create/rename. */
  function showInlineInput(placeholder, onSubmit) {
    const root = ensureRoot();
    if (!root) return;
    const row = ZG.ui.el("div", "zg-inline-row");
    const input = ZG.ui.el("input", "zg-search");
    input.placeholder = placeholder;
    const ok = ZG.ui.btn("确定", "zg-btn-primary", async () => {
      await onSubmit(input.value.trim());
      row.remove();
    });
    const cancel = ZG.ui.btn("取消", "", () => row.remove());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") ok.click();
      if (e.key === "Escape") row.remove();
    });
    row.appendChild(input);
    row.appendChild(ok);
    row.appendChild(cancel);
    root.insertBefore(row, root.firstChild);
    setTimeout(() => input.focus(), 0);
  }

  // ── entry list ─────────────────────────────────────────────────────────────

  async function renderList() {
    if (!_list) return;
    const q = (_search ? _search.value : "").trim().toLowerCase();
    let entries = await ZG.glossary.all(_currentBook || undefined);
    if (q) {
      entries = entries.filter(
        (e) =>
          (e.term || "").toLowerCase().includes(q) ||
          (e.zh || "").toLowerCase().includes(q) ||
          (e.en || "").toLowerCase().includes(q) ||
          (e.category || "").toLowerCase().includes(q)
      );
    }

    _list.textContent = "";
    if (!entries.length) {
      const empty = ZG.ui.el(
        "div",
        "zg-empty",
        q ? "没有匹配的名词" : "「" + (_currentBook || "默认名词本") + "」还是空的\n在文献中选中术语 → 查询 → 收藏"
      );
      _list.appendChild(empty);
      return;
    }

    for (const e of entries) {
      _list.appendChild(entryRow(e));
    }
  }

  function entryRow(e) {
    const item = ZG.ui.el("div", "zg-item");
    const main = ZG.ui.el("div", "zg-item-main");

    const termLine = ZG.ui.el("div", "");
    termLine.appendChild(ZG.ui.el("span", "zg-item-term", e.term || ""));
    if (e.category) termLine.appendChild(ZG.ui.el("span", "zg-badge", e.category));
    main.appendChild(termLine);

    if (e.zh) main.appendChild(ZG.ui.el("div", "zg-item-zh", e.zh));
    const metaBits = [];
    if (e.en) metaBits.push(e.en);
    const date = e.savedAt ? new Date(e.savedAt).toLocaleDateString() : "";
    if (date) metaBits.push(date);
    if (metaBits.length) {
      main.appendChild(ZG.ui.el("div", "zg-item-meta", metaBits.join(" · ")));
    }
    item.appendChild(main);

    const copyBtn = ZG.ui.btn("复制", "", () => {
      const text = `${e.term}${e.zh ? "\n" + e.zh : ""}${e.en ? "\n" + e.en : ""}`;
      const d = ZG.ui.doc();
      if (d.defaultView.navigator.clipboard && d.defaultView.navigator.clipboard.writeText) {
        d.defaultView.navigator.clipboard.writeText(text).catch(() => {});
      } else {
        try {
          const helper = d.createElementNS("http://www.w3.org/1999/xhtml", "input");
          helper.value = text;
          (d.body || d.documentElement).appendChild(helper);
          helper.select();
          d.execCommand("copy");
          helper.remove();
        } catch (_) {
          /* ignore */
        }
      }
      copyBtn.textContent = "✓ 已复制";
      setTimeout(() => (copyBtn.textContent = "复制"), 1200);
    });

    const delBtn = ZG.ui.btn("删除", "zg-btn-danger", async () => {
      await ZG.glossary.remove(e.term, _currentBook || undefined);
      await renderList();
    });

    item.appendChild(copyBtn);
    item.appendChild(delBtn);
    return item;
  }

  return { open, close, toggle };
})();
