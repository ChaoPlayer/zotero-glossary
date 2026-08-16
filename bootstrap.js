/*
 * Zotero Glossary — ROOT bootstrap (classic bootstrap mode).
 *
 * Zotero 7/8/9 load this file from the XPI ROOT and call the lifecycle
 * methods below (install / startup / shutdown / uninstall), plus the
 * optional onMainWindowLoad / onMainWindowUnload hooks. This is the same
 * structure as the official "Make It Red" example and Zotero-pdf-translate.
 *
 * No manifest experiment_apis entry is used (Zotero 9 ignores it and
 * dispatches lifecycle through this root bootstrap instead).
 */
"use strict";

/* global globalThis, Services, Zotero, Components */

var ZG = (globalThis.ZG = globalThis.ZG || {});

function install(data, reason) {
  Zotero.debug("[Zotero Glossary] install");
  try {
    Zotero.notify("Zotero Glossary 已安装 ✓");
  } catch (e) {
    /* ignore */
  }
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  await Zotero.initializationPromise;

  if (ZG._started) return;
  ZG._started = true;
  Zotero.debug("[Zotero Glossary] startup (classic bootstrap)");
  try {
    Zotero.notify("Zotero Glossary 已启动 ✓（选中词语即可查询）");
  } catch (e) {
    /* ignore */
  }

  // Zotero 7+ provides rootURI; fall back to resourceURI.spec.
  let root = rootURI || (resourceURI && resourceURI.spec) || "";
  if (!root.endsWith("/")) root += "/";
  ZG.rootURI = root + "addon/";

  ZG.loadModule = function (relPath) {
    const uri = ZG.rootURI + relPath;
    Zotero.debug("[Zotero Glossary] load module " + uri);
    Services.scriptloader.loadSubScript(uri);
  };

  try {
    ZG.loadModule("modules/prefs.js");
    ZG.loadModule("modules/llm.js");
    ZG.loadModule("modules/glossary.js");
    ZG.loadModule("modules/ui.js");
    ZG.loadModule("modules/popup.js");
    ZG.loadModule("modules/glossary-pane.js");
    ZG.loadModule("modules/selection.js");
    ZG.loadModule("modules/settings.js");
    ZG.loadModule("modules/boot.js");
  } catch (e) {
    ZG._started = false;
    Zotero.debug(`[Zotero Glossary] startup failed: ${e}\n${e && e.stack}`, 2);
    try {
      Zotero.notify("Zotero Glossary 启动失败: " + e);
    } catch (_) {
      /* ignore */
    }
    return;
  }

  ZG.boot.ensureStarted().catch((e) => {
    Zotero.debug(`[Zotero Glossary] boot error: ${e}`, 2);
  });
}

/** Called by Zotero when the main window loads (Zotero 7+ bootstrap hook). */
function onMainWindowLoad({ window }, reason) {
  try {
    if (ZG.boot && ZG.boot.onMainWindowLoad) {
      ZG.boot.onMainWindowLoad(window);
    }
  } catch (e) {
    Zotero.debug(`[Zotero Glossary] onMainWindowLoad: ${e}`, 2);
  }
}

function onMainWindowUnload({ window }, reason) {
  // UI elements are destroyed with the window; nothing to do.
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  try {
    if (ZG.boot && ZG.boot.cleanup) ZG.boot.cleanup();
  } catch (e) {
    Zotero.debug(`[Zotero Glossary] shutdown error: ${e}`, 2);
  }
  ZG._started = false;
}

function uninstall(data, reason) {
  Zotero.debug("[Zotero Glossary] uninstall");
}
