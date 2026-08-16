# Zotero Glossary（专业名词查询）

> 在 Zotero 7/8/9 中阅读文献时，选中生僻专业名词 → 点击「🔍 专业名词查询」→ 由大模型（默认 DeepSeek）给出**中文解释 + 英文释义 + 例句**，并可收藏到自己的**多名词本**（EN ⇄ ZH），构建个人术语库。

[![Zotero](https://img.shields.io/badge/Zotero-7%2F8%2F9-blue)](https://www.zotero.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## ✨ 特性

- **点击式查询，省 token**：选中文字后只出现一个小按钮（紧贴选中词），**点击才调用大模型 API**，避免误选/拖选浪费 token
- **专业名词解释**：中文解释、英文释义、所属学科、例句，由 LLM 生成（OpenAI 兼容端点，默认 DeepSeek）
- **领域提示词**：在设置中填写你的研究领域（如「电池、电池管理系统」），查询缩写/专业词时优先按该领域解释
- **多名词本**：可创建多个名词本（如按课题/文章分类），收藏时选择目标名词本；支持新建 / 重命名 / 删除 / 搜索 / 复制 / 删除条目
- **设置面板**：API Key、模型、超时、研究领域、名词本管理，全部在 **编辑 → 设置 → Glossary** 中完成
- **多入口**：PDF/EPub 阅读器（官方 Reader 事件）、网页/笔记选词、工具栏按钮、`Ctrl+Alt+B` 名词本、`Ctrl+Alt+Q` 手动查询

## 📦 安装

1. 前往 [Releases](https://github.com/OWNER/zotero-glossary/releases) 下载最新的 `zotero-glossary.xpi`
2. Zotero 7/8/9：**工具 → 附加组件 → 齿轮 → Install Add-on From File…** → 选择该文件
3. 重启 Zotero
4. **编辑 → 设置 → Glossary**：填入 DeepSeek API Key（[platform.deepseek.com](https://platform.deepseek.com) 注册获取），点「测试连接」验证

> 兼容任何 OpenAI 风格 `/chat/completions` 端点：修改 **API Base URL** 与 **模型** 即可。

## 🚀 使用

| 操作 | 效果 |
|---|---|
| 选中文献中的词 | 选中词下方出现「🔍 专业名词查询」按钮 |
| 点击按钮 | 发起大模型查询，弹出解释卡片 |
| 卡片内「收藏到 [名词本]」+ ☆ 收藏 | 术语加入指定名词本 |
| 菜单 工具 → Zotero Glossary → 专业名词本（或 `Ctrl+Alt+B`） | 浏览名词本条目 |
| 编辑 → 设置 → Glossary → 名词本管理 | 新建 / 重命名 / 删除名词本、查看条目 |
| 设置 → 研究领域 | 如「电池、电池管理系统」→ 缩写按领域优先解释 |

名词本数据保存在 Zotero 数据目录下的 `zotero-glossary.json`（可在设置中改名）。

## 🔧 开发

### 环境
- Node.js（仅用于语法校验 `node --check`）
- Windows PowerShell（`build.ps1` 打包，也可手动压缩为 zip 改后缀 `.xpi`）

### 构建
```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
# 生成 zotero-glossary.xpi（zip 内条目必须用正斜杠，脚本已处理）
```

### 目录结构
```
zotero-glossary/
├── manifest.json              # Zotero 9 格式清单（applications.zotero）
├── bootstrap.js               # 根目录生命周期入口（经典 bootstrap）
├── build.ps1                  # 一键打包 XPI
└── addon/modules/
    ├── prefs.js               # 偏好（含研究领域）
    ├── llm.js                 # LLM 客户端 + 领域提示词
    ├── glossary.js            # 多名词本存储（JSON，v2 数据模型）
    ├── ui.js                  # 共享 UI（XUL 兼容元素创建）
    ├── popup.js               # 查询卡片 + 点击式查询小按钮
    ├── glossary-pane.js       # 名词本浏览面板
    ├── selection.js           # 选词捕获（Reader 官方事件）
    ├── settings.js            # 设置面板（XUL 片段 + 名词本管理）
    └── boot.js                # 装配（工具菜单、快捷键）
```

### Zotero 9 兼容性要点（踩坑记录）
- manifest 用 **`applications.zotero`**（不是 `applications.gecko`），且 `id`/`update_url`/`strict_max_version` 必填
- **不要用 `experiment_apis`**（Zotero 9 会优先走该路径导致 bootstrap 不被调用）；用根目录 `bootstrap.js` 经典模式（`startup({id,version,resourceURI,rootURI})` + `await Zotero.initializationPromise`）
- `Zotero.Reader.registerEventListener("renderTextSelectionPopup", ...)` 是 PDF 选词的正确姿势
- 主窗口是 XUL：无 `document.body`；HTML 元素须 `createElementNS(XHTML)`；偏好面板是 XUL 片段（非 HTML 文档）
- 插件沙箱无 `AbortController`、无 `ChromeUtils.import()`

## 📤 更新机制

`manifest.json` 中 `update_url` 应指向一个更新清单（Firefox update manifest 格式）。发布新版本时可同步更新 `update.json` 与 Releases 附件。仓库内已保留占位说明。

## 📄 License

[MIT](LICENSE)
