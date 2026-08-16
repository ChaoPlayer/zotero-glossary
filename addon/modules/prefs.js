/*
 * Zotero Glossary — preferences.
 *
 * Reads/writes Zotero preferences under "extensions.zotero.glossary." with
 * in-code defaults, so nothing breaks if the branch is not registered.
 */
"use strict";

/* global ZG, Zotero, Services */

ZG.prefs = (() => {
  const BRANCH = "extensions.zotero.glossary.";

  const DEFAULTS = {
    // LLM provider settings (OpenAI-compatible chat completions endpoint).
    apiKey: "",
    apiBase: "https://api.deepseek.com", // e.g. https://api.deepseek.com or .../v1
    model: "deepseek-chat", // deepseek-chat | deepseek-reasoner
    temperature: 0.3,
    timeoutMs: 60000,

    // Popup behavior.
    popupEnabled: true, // show the lookup popup automatically on selection
    minSelectionLength: 2,
    maxSelectionLength: 80,
    // zh | en | auto — what the popup should display first.
    displayLang: "zh",

    // Glossary book.
    glossaryFileName: "zotero-glossary.json",
    lastBook: "",

    // Research domain hint sent to the LLM (e.g. "电池、电池管理系统").
    researchFields: "",

    // UI language for the addon's own texts.
    locale: "zh",
  };

  /** Register defaults if the Zotero API supports it (Zotero 7 does). */
  function registerDefaults() {
    try {
      if (typeof Zotero.Prefs.registerBranch === "function") {
        Zotero.Prefs.registerBranch(BRANCH, DEFAULTS);
      }
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] registerBranch: ${e}`, 2);
    }
  }

  function get(key) {
    const def = DEFAULTS[key];
    try {
      const v = Zotero.Prefs.get(BRANCH + key);
      return v === undefined || v === null || v === "" ? def : v;
    } catch (e) {
      return def;
    }
  }

  function set(key, value) {
    try {
      Zotero.Prefs.set(BRANCH + key, value);
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] set pref ${key}: ${e}`, 2);
    }
  }

  function all() {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = get(k);
    return out;
  }

  return {
    BRANCH,
    DEFAULTS,
    registerDefaults,
    get,
    set,
    all,
  };
})();
