/*
 * Zotero Glossary — preference pane.
 *
 * Zotero 9 preference panes are XUL fragments (like Zotero-pdf-translate's
 * preferences.xhtml): a <vbox> root with <checkbox>/<html:input> elements
 * that bind to preferences via the "preference" attribute, plus a couple of
 * buttons whose oncommand handlers live on Zotero.GlossaryPrefs.
 *
 * The fragment is written to the Zotero profile directory and registered
 * with Zotero.PreferencePanes (src must be a file:// URL, not a bare path).
 */
"use strict";

/* global ZG, Zotero, Services, IOUtils, PathUtils */

ZG.settings = (() => {
  const PLUGIN_ID = "glossary@zotero.local";
  let _registered = false;
  let _panePath = null;
  let _paneDoc = null;

  /** XUL fragment for the preferences window. No inline <script>. */
  function buildXhtml() {
    return `<vbox xmlns:html="http://www.w3.org/1999/xhtml" id="zotero-prefpane-glossary" onload="Zotero.GlossaryPrefs.onLoad(event)">
  <groupbox>
    <label><html:h2>大模型配置</html:h2></label>
    <hbox align="center">
      <label flex="1">API Key（DeepSeek 等 OpenAI 兼容服务）</label>
      <html:input id="zg-apiKey" type="password" preference="extensions.zotero.glossary.apiKey" style="min-width: 260px"/>
    </hbox>
    <hbox align="center">
      <label flex="1">API Base URL</label>
      <html:input id="zg-apiBase" type="text" preference="extensions.zotero.glossary.apiBase" style="min-width: 260px"/>
    </hbox>
    <hbox align="center">
      <label flex="1">模型（deepseek-chat 等）</label>
      <html:input id="zg-model" type="text" preference="extensions.zotero.glossary.model" style="min-width: 260px"/>
    </hbox>
    <hbox align="center">
      <label flex="1">温度</label>
      <html:input id="zg-temperature" type="number" step="0.1" min="0" max="2" preference="extensions.zotero.glossary.temperature" style="min-width: 260px"/>
    </hbox>
    <hbox align="center">
      <label flex="1">超时（毫秒）</label>
      <html:input id="zg-timeoutMs" type="number" min="1000" preference="extensions.zotero.glossary.timeoutMs" style="min-width: 260px"/>
    </hbox>
  </groupbox>
  <groupbox>
    <label><html:h2>查询与名词本</html:h2></label>
    <hbox align="center">
      <label flex="1">研究领域（查询时优先按此领域解释）</label>
      <html:input id="zg-researchFields" type="text" style="min-width: 260px"/>
    </hbox>
    <hbox align="center">
      <label flex="1">选中文字后显示「专业名词查询」按钮</label>
      <checkbox id="zg-popupEnabled" native="true" preference="extensions.zotero.glossary.popupEnabled"/>
    </hbox>
    <hbox align="center">
      <label flex="1">最短选中长度</label>
      <html:input id="zg-minSelectionLength" type="number" min="1" preference="extensions.zotero.glossary.minSelectionLength" style="min-width: 260px"/>
    </hbox>
    <hbox align="center">
      <label flex="1">最长选中长度</label>
      <html:input id="zg-maxSelectionLength" type="number" min="10" preference="extensions.zotero.glossary.maxSelectionLength" style="min-width: 260px"/>
    </hbox>
    <hbox align="center">
      <label flex="1">名词本文件名</label>
      <html:input id="zg-glossaryFileName" type="text" preference="extensions.zotero.glossary.glossaryFileName" style="min-width: 260px"/>
    </hbox>
  </groupbox>
  <groupbox>
    <label><html:h2>名词本管理</html:h2></label>
    <hbox align="center">
      <menulist id="zg-book-list" style="min-width: 220px"><menupopup/></menulist>
      <button id="zg-book-open" label="查看条目" oncommand="Zotero.GlossaryPrefs.bookOpen()"/>
      <button id="zg-book-new" label="新建" oncommand="Zotero.GlossaryPrefs.bookNew()"/>
      <button id="zg-book-rename" label="重命名" oncommand="Zotero.GlossaryPrefs.bookRename()"/>
      <button id="zg-book-delete" label="删除" oncommand="Zotero.GlossaryPrefs.bookDelete()"/>
    </hbox>
    <hbox id="zg-book-input-row" align="center" hidden="true">
      <label id="zg-book-input-label" flex="1"/>
      <html:input id="zg-book-input" type="text" style="min-width: 220px"/>
      <button id="zg-book-input-ok" label="确定" oncommand="Zotero.GlossaryPrefs.bookInputOk()"/>
      <button id="zg-book-input-cancel" label="取消" oncommand="Zotero.GlossaryPrefs.bookInputCancel()"/>
    </hbox>
    <label id="zg-book-status" value=""/>
    <label class="zg-hint">在文献中选中术语 → 查询 → 收藏到指定名词本；弹窗与查询结果卡片中的「名词本」按钮可随时查看条目。</label>
  </groupbox>
  <hbox align="center" style="margin-top: 12px">
    <button id="zg-save" label="保存" oncommand="Zotero.GlossaryPrefs.save()"/>
    <button id="zg-test" label="测试连接" oncommand="Zotero.GlossaryPrefs.test()"/>
    <button id="zg-reset" label="恢复默认" oncommand="Zotero.GlossaryPrefs.reset()"/>
    <label id="zg-status" value=""/>
  </hbox>
</vbox>
`;
  }

  // ── hooks exposed to the pane (oncommand / onload) ────────────────────────

  function $(id) {
    try {
      return _paneDoc ? _paneDoc.getElementById(id) : null;
    } catch (e) {
      return null;
    }
  }

  function setField(id, value) {
    const el = $(id);
    if (el) el.value = value == null ? "" : String(value);
  }

  function setStatus(text, isErr) {
    try {
      const el = $("zg-status");
      if (!el) return;
      el.value = text;
      el.style.color = isErr ? "#d70022" : text.startsWith("✓") ? "#0a8f2c" : "";
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] setStatus: ${e}`, 2);
    }
  }

  /** Fill the pane controls from preferences (preference="" auto-binding is
   *  unreliable in Zotero 9, so we manage values manually). */
  function populate() {
    setField("zg-apiKey", ZG.prefs.get("apiKey"));
    setField("zg-apiBase", ZG.prefs.get("apiBase"));
    setField("zg-model", ZG.prefs.get("model"));
    setField("zg-temperature", ZG.prefs.get("temperature"));
    setField("zg-timeoutMs", ZG.prefs.get("timeoutMs"));
    setField("zg-minSelectionLength", ZG.prefs.get("minSelectionLength"));
    setField("zg-maxSelectionLength", ZG.prefs.get("maxSelectionLength"));
    setField("zg-glossaryFileName", ZG.prefs.get("glossaryFileName"));
    setField("zg-researchFields", ZG.prefs.get("researchFields"));
    const cb = $("zg-popupEnabled");
    if (cb) cb.checked = ZG.prefs.get("popupEnabled") !== false;
  }

  /** Read the pane controls and persist them to preferences. */
  function save() {
    if (!$("zg-apiKey")) return;
    ZG.prefs.set("apiKey", $("zg-apiKey").value.trim());
    ZG.prefs.set("apiBase", $("zg-apiBase").value.trim() || "https://api.deepseek.com");
    ZG.prefs.set("model", $("zg-model").value.trim() || "deepseek-chat");
    ZG.prefs.set("temperature", parseFloat($("zg-temperature").value) || 0.3);
    ZG.prefs.set("timeoutMs", parseInt($("zg-timeoutMs").value, 10) || 60000);
    ZG.prefs.set("minSelectionLength", parseInt($("zg-minSelectionLength").value, 10) || 2);
    ZG.prefs.set("maxSelectionLength", parseInt($("zg-maxSelectionLength").value, 10) || 80);
    ZG.prefs.set("glossaryFileName", $("zg-glossaryFileName").value.trim() || "zotero-glossary.json");
    ZG.prefs.set("researchFields", $("zg-researchFields").value.trim());
    const cb = $("zg-popupEnabled");
    if (cb) ZG.prefs.set("popupEnabled", cb.checked);
  }

  // ── book management (called from the preference pane) ─────────────────────

  let _bookInputMode = ""; // "" | "new" | "rename"

  function bookSelected() {
    const menu = $("zg-book-list");
    if (menu && menu.selectedItem) return menu.selectedItem.getAttribute("value") || "";
    if (menu && menu.selectedIndex >= 0 && menu.itemCount) {
      return menu.getItemAtIndex(menu.selectedIndex).getAttribute("value") || "";
    }
    return "";
  }

  function setBookStatus(text, isErr) {
    const el = $("zg-book-status");
    if (!el) return;
    el.value = text;
    el.style.color = isErr ? "#d70022" : text.startsWith("✓") ? "#0a8f2c" : "";
  }

  async function bookRefresh() {
    const menu = $("zg-book-list");
    if (!menu) return;
    const popup = menu.querySelector("menupopup") || menu.firstElementChild;
    if (!popup) return;
    while (popup.firstChild) popup.removeChild(popup.firstChild);
    const books = await ZG.glossary.listBooks();
    for (const b of books) {
      const mi = _paneDoc.createXULElement("menuitem");
      mi.setAttribute("label", b);
      mi.setAttribute("value", b);
      popup.appendChild(mi);
    }
    if (books.length) menu.selectedIndex = 0;
  }

  function showBookInput(labelText, value) {
    _bookInputMode = labelText.indexOf("重命名") === 0 ? "rename" : "new";
    const lbl = $("zg-book-input-label");
    const input = $("zg-book-input");
    const row = $("zg-book-input-row");
    if (lbl) lbl.value = labelText;
    if (input) input.value = value;
    if (row) row.hidden = false;
    if (input) {
      try {
        input.focus();
      } catch (e) {
        /* ignore */
      }
    }
  }

  async function bookInputOk() {
    const input = $("zg-book-input");
    const row = $("zg-book-input-row");
    const name = input ? input.value.trim() : "";
    if (row) row.hidden = true;
    if (_bookInputMode === "rename") {
      const n = await ZG.glossary.renameBook(bookSelected(), name);
      if (n) {
        await bookRefresh();
        setBookStatus("✓ 已重命名", false);
      } else {
        setBookStatus("✗ 重命名失败", true);
      }
    } else {
      const n = await ZG.glossary.createBook(name);
      if (n) {
        await bookRefresh();
        setBookStatus("✓ 已新建名词本", false);
      } else {
        setBookStatus("✗ 名称无效", true);
      }
    }
  }

  function bookInputCancel() {
    const row = $("zg-book-input-row");
    if (row) row.hidden = true;
  }

  async function bookDelete() {
    const name = bookSelected();
    if (!name || name === "默认名词本") {
      setBookStatus("默认名词本不可删除", true);
      return;
    }
    let ok = false;
    try {
      ok = Services.prompt.confirm(
        ZG.ui.doc().defaultView,
        "删除名词本",
        "确定删除名词本「" + name + "」？其中的条目也会被删除。"
      );
    } catch (e) {
      ok = true;
    }
    if (!ok) return;
    const del = await ZG.glossary.deleteBook(name);
    if (del) {
      await bookRefresh();
      setBookStatus("✓ 已删除", false);
    }
  }

  function installPrefsHooks() {
    try {
      Zotero.GlossaryPrefs = {
        onLoad(ev) {
          try {
            _paneDoc = ev && ev.target ? ev.target.ownerDocument : null;
          } catch (e) {
            _paneDoc = null;
          }
          populate();
          bookRefresh().catch(() => {});
        },
        save() {
          save();
          setStatus("✓ 已保存", false);
        },
        test() {
          save();
          const key = ZG.prefs.get("apiKey");
          const base = (ZG.prefs.get("apiBase") || "https://api.deepseek.com").replace(/\/+$/, "");
          if (!key) {
            setStatus("✗ 请先填写 API Key", true);
            return;
          }
          setStatus("测试中…", false);
          Zotero.HTTP.request("GET", base + "/models", {
            headers: { Authorization: "Bearer " + key },
            responseType: "json",
            timeout: 15000,
          })
            .then((resp) => {
              setStatus(
                resp.status === 200 ? "✓ 连接成功" : "✗ 连接失败 HTTP " + resp.status,
                resp.status !== 200
              );
            })
            .catch((e) => {
              setStatus("✗ 连接失败: " + (e && e.message ? e.message : e), true);
            });
        },
        reset() {
          for (const k of Object.keys(ZG.prefs.DEFAULTS)) {
            ZG.prefs.set(k, ZG.prefs.DEFAULTS[k]);
          }
          populate();
          setStatus("✓ 已恢复默认", false);
        },
        bookOpen() {
          ZG.glossaryPane.open();
        },
        bookNew() {
          showBookInput("新建名词本名称：", "");
        },
        bookRename() {
          showBookInput("重命名为：", bookSelected());
        },
        bookDelete() {
          bookDelete().catch(() => {});
        },
        bookInputOk() {
          bookInputOk().catch(() => {});
        },
        bookInputCancel() {
          bookInputCancel();
        },
      };
      Zotero.debug("[Zotero Glossary] prefs hooks installed", 1);
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] installPrefsHooks: ${e}`, 2);
    }
  }

  // ── registration ──────────────────────────────────────────────────────────

  /** Wait until Zotero.PreferencePanes is available (Zotero may still boot). */
  async function waitForPreferencePanes(timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (Zotero.PreferencePanes && typeof Zotero.PreferencePanes.register === "function") {
          return true;
        }
      } catch (e) {
        /* getter may throw pre-init */
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }

  /** Write the pane file and register it once. */
  async function ensurePane() {
    if (_registered) return;
    installPrefsHooks();
    const ready = await waitForPreferencePanes();
    if (!ready) {
      Zotero.debug("[Zotero Glossary] ensurePane: Zotero.PreferencePanes unavailable (timeout)", 2);
      return;
    }
    try {
      const dir = PathUtils.join(PathUtils.profileDir, "zotero-glossary");
      try {
        await IOUtils.makeDirectory(dir, { ignoreExisting: true });
      } catch (_) {
        /* may already exist */
      }
      const path = PathUtils.join(dir, "preferences.xhtml");
      await IOUtils.writeUTF8(path, buildXhtml(), {
        tmpPath: path + ".tmp",
      });
      _panePath = path;

      // Zotero loads the pane src as a URL — use file://, not a bare path.
      const url = new URL("file://" + path.replace(/\\/g, "/")).href;
      Zotero.PreferencePanes.register({
        pluginID: PLUGIN_ID,
        src: url,
        label: "Glossary",
        image: "",
      });
      _registered = true;
      Zotero.debug(`[Zotero Glossary] preference pane registered: ${url}`);
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] ensurePane: ${e}`, 2);
    }
  }

  /** Open the preferences window on this pane. */
  function openPane() {
    ensurePane().then(() => {
      const win = Zotero.getMainWindow();
      if (!win || !win.ZoteroPane) return;
      try {
        if (Zotero.PreferencePanes && typeof Zotero.PreferencePanes.open === "function") {
          Zotero.PreferencePanes.open(PLUGIN_ID);
          return;
        }
      } catch (e) {
        Zotero.debug(`[Zotero Glossary] PreferencePanes.open: ${e}`, 2);
      }
      try {
        win.ZoteroPane.openPreferences(PLUGIN_ID);
      } catch (e) {
        Zotero.debug(`[Zotero Glossary] openPreferences: ${e}`, 2);
      }
    });
  }

  return { ensurePane, openPane };
})();
