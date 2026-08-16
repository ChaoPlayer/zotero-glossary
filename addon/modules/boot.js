/*
 * Zotero Glossary — boot orchestration.
 *
 * Wires everything together after the modules are loaded:
 * preferences, glossary store, selection watchers, popup, glossary pane,
 * settings pane, toolbar button and keyboard shortcuts.
 */
"use strict";

/* global ZG, Zotero */

ZG.boot = (() => {
  let _cleaned = false;

  async function ensureStarted() {
    Zotero.debug("[Zotero Glossary] ensureStarted");
    // 1. Preferences.
    ZG.prefs.registerDefaults();

    // 2. Glossary store (best-effort preload).
    try {
      await ZG.glossary.load();
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] glossary load: ${e}`, 2);
    }

    // 3. Selection watchers (attach to the main window when it exists,
    //    and keep scanning for new readers every few seconds).
    ZG.selection.start();

    // 4. Settings pane registration (waits for Zotero.PreferencePanes).
    ZG.settings.ensurePane().catch((e) => {
      Zotero.debug(`[Zotero Glossary] settings pane: ${e}`, 2);
    });

    // 5. Toolbar button + shortcuts arrive via onMainWindowLoad below
    //    (Zotero 7+ bootstrap hook); also try immediately in case the
    //    window is already up.
    const win = Zotero.getMainWindow();
    if (win) {
      addToolbarButton(win);
      addShortcuts(win);
    }
  }

  /**
   * Zotero 7+ bootstrap hook: called each time the main window loads.
   * Attach toolbar button, tools-menu entries and keyboard shortcuts here.
   */
  function onMainWindowLoad(win) {
    if (!win || !win.document) return;
    try {
      addToolbarButton(win);
      addToolsMenu(win);
      addShortcuts(win);
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] onMainWindowLoad: ${e}`, 2);
    }
  }

  /** Add a "Zotero Glossary" submenu to the main "工具" (Tools) menu. */
  function addToolsMenu(win) {
    const doc = win.document;
    const toolsMenu = doc.getElementById("menu_Tools");
    if (!toolsMenu) return;
    if (doc.getElementById("zg-menu-glossary")) return;
    const popup = toolsMenu.querySelector("menupopup");
    if (!popup) return;

    const sep = doc.createXULElement("menuseparator");
    const menu = doc.createXULElement("menu");
    menu.id = "zg-menu-glossary";
    menu.setAttribute("label", "Zotero Glossary");
    const sub = doc.createXULElement("menupopup");

    const itemBook = doc.createXULElement("menuitem");
    itemBook.setAttribute("label", "专业名词本");
    itemBook.setAttribute("accesskey", "G");
    itemBook.addEventListener("command", () => ZG.glossaryPane.open());

    const itemPrefs = doc.createXULElement("menuitem");
    itemPrefs.setAttribute("label", "设置");
    itemPrefs.addEventListener("command", () => ZG.settings.openPane());

    sub.appendChild(itemBook);
    sub.appendChild(itemPrefs);
    menu.appendChild(sub);
    popup.appendChild(sep);
    popup.appendChild(menu);
  }

  /** Add a "名词本" button to the main toolbar (Zotero 7). */
  function addToolbarButton(win) {
    try {
      const doc = win.document;
      const toolbar = doc.getElementById("zotero-toolbar");
      if (!toolbar) return;
      if (doc.getElementById("zotero-glossary-button")) return;

      const btn = doc.createElement("toolbarbutton");
      btn.id = "zotero-glossary-button";
      btn.setAttribute("label", "名词本");
      btn.setAttribute("tooltiptext", "Zotero Glossary 专业名词本（快捷键 Ctrl+Alt+B）");
      btn.style.listStyleImage = "none";
      btn.addEventListener("click", () => ZG.glossaryPane.toggle());
      toolbar.appendChild(btn);
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] toolbar button: ${e}`, 2);
    }
  }

  /** Keyboard shortcuts in the main window. */
  function addShortcuts(win) {
    try {
      win.document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.altKey && !e.shiftKey) {
          if (e.key === "b" || e.key === "B") {
            e.preventDefault();
            ZG.glossaryPane.toggle();
          } else if (e.key === "q" || e.key === "Q") {
            e.preventDefault();
            queryCurrentSelection(win);
          }
        }
      });
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] shortcuts: ${e}`, 2);
    }
  }

  /** Ctrl+Alt+Q: query whatever is selected right now (any context). */
  function queryCurrentSelection(win) {
    try {
      // Main window selection.
      const sel = win.getSelection && win.getSelection();
      if (sel && !sel.isCollapsed) {
        const text = String(sel.toString() || "").trim().replace(/\s+/g, " ").slice(0, 80);
        if (text) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          ZG.popup.show({
            term: text,
            x: rect ? rect.left : 100,
            y: rect ? rect.bottom + 8 : 100,
            source: "",
          });
          return;
        }
      }
      Zotero.getMainWindow().alert("请先在页面或 PDF 中选中一个术语，再按 Ctrl+Alt+Q。");
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] queryCurrentSelection: ${e}`, 2);
    }
  }

  function cleanup() {
    if (_cleaned) return;
    _cleaned = true;
    try {
      ZG.selection.stop();
      ZG.popup.hide();
      ZG.glossaryPane.close();
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] cleanup: ${e}`, 2);
    }
  }

  return { ensureStarted, onMainWindowLoad, cleanup };
})();
