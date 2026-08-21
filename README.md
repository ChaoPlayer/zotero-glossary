# Zotero Glossary

<p align="center">
  <img src="logo.png" alt="Zotero Glossary" width="180" />
</p>

> Look up unfamiliar technical terms while reading in Zotero. Select a word in a PDF, EPub, webpage or note, click the "Term Lookup" button, and an LLM (DeepSeek by default) explains it — then save it to your own **multi-book glossary** (EN ⇄ ZH).

[![Zotero](https://img.shields.io/badge/Zotero-7%2F8%2F9-blue)](https://www.zotero.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

[中文文档](README.zh-CN.md)

---

## ✨ Features

- **Click-to-query, token friendly** — selecting text never calls the API; a small button appears right next to your selection, and only clicking it triggers the LLM. No wasted tokens from accidental or mid-drag selections.
- **Full explanations** — Chinese explanation, English definition, field/category, and an example sentence.
- **Domain-aware prompts** — configure your research field in settings (e.g. "battery, battery management systems"); acronyms like *SOC*, *BMS*, *SEI* are explained from that domain first.
- **Multiple glossary books** — organize saved terms per project or per paper; create, rename, delete, search, copy, and remove entries anytime.
- **Any OpenAI-compatible endpoint** — DeepSeek works out of the box (just an API key); point it at any compatible service by changing the base URL and model.
- **Multiple entry points** — PDF/EPub reader, webpages and notes, the Tools menu, toolbar button, `Ctrl+Alt+B` for the glossary, `Ctrl+Alt+Q` for a manual lookup.

## 📦 Installation

1. Download the latest `zotero-glossary.xpi` from the [Releases](https://github.com/ChaoPlayer/zotero-glossary/releases) page.
2. In Zotero: **Tools → Add-ons → gear icon → Install Add-on From File…** → select the file.
3. Restart Zotero.
4. **Edit → Settings → Glossary**: paste your API key (get one at [platform.deepseek.com](https://platform.deepseek.com)), click **Test Connection**, then **Save**.

> Any OpenAI-compatible `/chat/completions` endpoint works: change **API Base URL** and **model** in settings.

## 🚀 Usage

| Action | Result |
|---|---|
| Select a term in a document | A "🔍 专业名词查询 (Term Lookup)" button appears right below Zotero's selection popup |
| Click the button | The LLM explains the term in a card (Chinese + English + example) |
| Choose a glossary book and click ☆ Favorite | The term is saved to that book |
| **Tools → Zotero Glossary → Glossary** (or `Ctrl+Alt+B`) | Browse your glossary entries |
| **Edit → Settings → Glossary → Book management** | Create / rename / delete glossary books, view entries |
| Settings → **Research fields** | e.g. "battery, battery management systems" — acronyms are explained from that domain first |

Glossary data is stored in `zotero-glossary.json` in your Zotero data directory (renameable in settings). Multiple books are supported; the default book cannot be deleted.

## ⚙️ Settings

- **API Key / Base URL / Model / Temperature / Timeout** — the LLM provider.
- **Research fields** — a hint sent with every lookup so abbreviations are resolved in your domain first.
- **Popup on selection** — whether the lookup button appears when text is selected.
- **Selection length limits** — minimum/maximum selection size that triggers the button.
- **Glossary file name** — where the glossary JSON lives.
- **Book management** — create, rename and delete glossary books.

## 🛠 Development

- Requirements: Node.js (for `node --check` syntax validation) and PowerShell (`build.ps1`).
- Build: `powershell -ExecutionPolicy Bypass -File .\build.ps1` → produces `zotero-glossary.xpi`.
- The addon is plain JavaScript, no runtime dependencies; source layout:

```
zotero-glossary/
├── manifest.json        # addon manifest (applications.zotero, Zotero 7-10)
├── bootstrap.js         # classic root bootstrap (lifecycle)
├── build.ps1            # one-click XPI packaging
└── addon/modules/
    ├── prefs.js         # preferences (incl. research fields)
    ├── llm.js           # LLM client + domain-aware prompt
    ├── glossary.js      # multi-book storage (JSON, v2 model)
    ├── ui.js            # shared UI helpers / styles
    ├── popup.js         # query card + click-to-query button
    ├── glossary-pane.js # glossary browsing panel
    ├── selection.js     # selection capture (Zotero Reader event)
    ├── settings.js      # preferences pane + book management
    └── boot.js          # wiring (Tools menu, shortcuts)
```

## 📄 License

[MIT](LICENSE)
