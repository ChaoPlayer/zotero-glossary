/*
 * Zotero Glossary — glossary books (favorites store, v2: multiple books).
 *
 * Persists a JSON document in the Zotero data directory (file name
 * configurable via preferences):
 *   <dataDir>/zotero-glossary.json
 *
 * Shape:
 *   { "version": 2,
 *     "books": ["默认名词本", "电池术语", ...],
 *     "entries": [{ term, lang, zh, en, category, example, source,
 *                   savedAt, book }] }
 *
 * v1 data (entries without a "book" field) is migrated on load.
 */
"use strict";

/* global ZG, Zotero, IOUtils, PathUtils */

ZG.glossary = (() => {
  const DEFAULT_BOOK = "默认名词本";
  let _filePath = null;
  let _data = { version: 2, books: [DEFAULT_BOOK], entries: [] };
  let _loadPromise = null;

  /** Path of the glossary JSON file (never null after load). */
  function filePath() {
    return _filePath;
  }

  /** Resolve and remember the storage path. */
  function resolvePath() {
    const name = ZG.prefs.get("glossaryFileName") || "zotero-glossary.json";
    let dir = null;
    try {
      if (Zotero.DataDirectory && Zotero.DataDirectory.dir) {
        dir = Zotero.DataDirectory.dir;
      } else if (typeof Zotero.getZoteroDirectory === "function") {
        dir = Zotero.getZoteroDirectory().path;
      }
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] data dir: ${e}`, 2);
    }
    if (!dir) dir = PathUtils.profileDir;
    _filePath = PathUtils.join(dir, name);
  }

  /** Normalize legacy (v1) data into the v2 shape. */
  function migrate(d) {
    const books = Array.isArray(d.books) && d.books.length ? d.books.slice() : [DEFAULT_BOOK];
    if (!books.includes(DEFAULT_BOOK)) books.unshift(DEFAULT_BOOK);
    const entries = (Array.isArray(d.entries) ? d.entries : []).map((e) => {
      const book = e.book && books.includes(e.book) ? e.book : DEFAULT_BOOK;
      return Object.assign({}, e, { book });
    });
    return { version: 2, books, entries };
  }

  /** Load data from disk (once). */
  async function load() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = (async () => {
      resolvePath();
      try {
        const raw = await IOUtils.readUTF8(_filePath, { decompress: false });
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.entries)) {
          _data = migrate(parsed);
        }
      } catch (e) {
        if (!(e && (e.name === "NotFoundError" || e.name === "NS_ERROR_FILE_NOT_FOUND"))) {
          Zotero.debug(`[Zotero Glossary] load glossary: ${e}`, 2);
        }
        _data = { version: 2, books: [DEFAULT_BOOK], entries: [] };
      }
      return _data;
    })();
    return _loadPromise;
  }

  /** Persist the current data. */
  async function save() {
    if (!_filePath) resolvePath();
    try {
      await IOUtils.writeUTF8(_filePath, JSON.stringify(_data, null, 2), {
        tmpPath: _filePath + ".tmp",
      });
    } catch (e) {
      Zotero.debug(`[Zotero Glossary] save glossary: ${e}`, 2);
      throw e;
    }
  }

  // ── books ─────────────────────────────────────────────────────────────────

  /** Names of all glossary books. */
  async function listBooks() {
    await load();
    return _data.books.slice();
  }

  /** Create a book; returns its name (or null). */
  async function createBook(name) {
    await load();
    const n = String(name || "").trim();
    if (!n) return null;
    if (_data.books.includes(n)) return n;
    _data.books.push(n);
    await save();
    return n;
  }

  /** Rename a book; returns the new name (or null). */
  async function renameBook(oldName, newName) {
    await load();
    const o = String(oldName || "").trim();
    const n = String(newName || "").trim();
    if (!o || !n || o === n) return null;
    const idx = _data.books.indexOf(o);
    if (idx < 0) return null;
    _data.books[idx] = n;
    for (const e of _data.entries) {
      if ((e.book || DEFAULT_BOOK) === o) e.book = n;
    }
    await save();
    return n;
  }

  /** Delete a book (the default book cannot be deleted); its entries are
   *  removed too. Returns true if deleted. */
  async function deleteBook(name) {
    await load();
    const n = String(name || "").trim();
    if (!n || n === DEFAULT_BOOK) return false;
    const idx = _data.books.indexOf(n);
    if (idx < 0) return false;
    _data.books.splice(idx, 1);
    _data.entries = _data.entries.filter((e) => (e.book || DEFAULT_BOOK) !== n);
    await save();
    return true;
  }

  // ── entries ────────────────────────────────────────────────────────────────

  /** Entries (optionally filtered by book). */
  async function all(book) {
    await load();
    const b = String(book || "").trim();
    if (!b) return _data.entries;
    return _data.entries.filter((e) => (e.book || DEFAULT_BOOK) === b);
  }

  /** Find entry by exact term (case-insensitive), optionally in a book. */
  async function find(term, book) {
    await load();
    const t = String(term || "").trim().toLowerCase();
    return (
      _data.entries.find(
        (e) =>
          e.term &&
          e.term.trim().toLowerCase() === t &&
          (!book || (e.book || DEFAULT_BOOK) === book)
      ) || null
    );
  }

  /** Insert or update an entry. Returns the saved entry. */
  async function upsert(entry) {
    await load();
    const t = String(entry.term || "").trim();
    if (!t) throw new Error("term 不能为空");
    const book = entry.book && _data.books.includes(entry.book) ? entry.book : DEFAULT_BOOK;
    const lower = t.toLowerCase();
    const idx = _data.entries.findIndex(
      (e) =>
        e.term &&
        e.term.trim().toLowerCase() === lower &&
        (e.book || DEFAULT_BOOK) === book
    );
    const now = new Date().toISOString();
    const rec = Object.assign(
      {
        term: t,
        lang: /[\u4e00-\u9fff]/.test(t) ? "zh" : "en",
        zh: "",
        en: "",
        category: "未分类",
        example: "",
        source: "",
        savedAt: now,
        book,
      },
      entry,
      { term: t, book, savedAt: entry && entry.savedAt ? entry.savedAt : now }
    );
    if (idx >= 0) {
      _data.entries[idx] = rec;
    } else {
      _data.entries.unshift(rec);
    }
    await save();
    return rec;
  }

  /** Remove an entry (optionally only from a specific book). */
  async function remove(term, book) {
    await load();
    const t = String(term || "").trim().toLowerCase();
    const before = _data.entries.length;
    _data.entries = _data.entries.filter(
      (e) =>
        !(
          e.term &&
          e.term.trim().toLowerCase() === t &&
          (!book || (e.book || DEFAULT_BOOK) === book)
        )
    );
    if (_data.entries.length !== before) {
      await save();
      return true;
    }
    return false;
  }

  /** Toggle favorite state in a book. Returns true if now favorited. */
  async function toggleFav(term, book) {
    const existing = await find(term, book);
    if (existing) {
      await remove(term, book);
      return false;
    }
    return true;
  }

  return {
    filePath,
    load,
    save,
    listBooks,
    createBook,
    renameBook,
    deleteBook,
    all,
    find,
    upsert,
    remove,
    toggleFav,
  };
})();
