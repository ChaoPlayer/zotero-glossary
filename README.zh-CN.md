# Zotero Glossary（专业名词查询）

<p align="center">
  <img src="logo.png" alt="Zotero Glossary" width="180" />
</p>

> 在 Zotero 7/8/9 中阅读文献时，选中生僻专业名词 → 点击「🔍 专业名词查询」→ 由大模型（默认 DeepSeek）给出**中文解释 + 英文释义 + 例句**，并可收藏到自己的**多名词本**（EN ⇄ ZH），构建个人术语库。

[![Zotero](https://img.shields.io/badge/Zotero-7%2F8%2F9-blue)](https://www.zotero.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

[English](README.md)

---

## ✨ 特性

- **点击式查询，节省 token**：选中文字不会调用任何接口，只会在选中位置出现一个小按钮；**点击按钮才发起大模型查询**，避免误选或拖选浪费 token。
- **完整解释**：中文解释、英文释义、所属学科领域、例句。
- **领域感知提示词**：在设置中填写你的研究领域（如"电池、电池管理系统"），查询 SOC、BMS、SEI 这类缩写时会优先按该领域解释。
- **多名词本**：按课题或按文章分类整理收藏的术语，支持新建、重命名、删除、搜索、复制。
- **兼容任意 OpenAI 风格接口**：默认 DeepSeek（只需一个 API Key），修改接口地址和模型即可接入其他兼容服务。
- **多入口**：PDF/EPub 阅读器、网页和笔记、工具菜单、工具栏按钮、`Ctrl+Alt+B` 打开名词本、`Ctrl+Alt+Q` 手动查询。

## 📦 安装

1. 从 [Releases](https://github.com/ChaoPlayer/zotero-glossary/releases) 页面下载最新的 `zotero-glossary.xpi`。
2. Zotero：**工具 → 附加组件 → 齿轮图标 → 从文件安装附加组件…** → 选择该文件。
3. 重启 Zotero。
4. **编辑 → 设置 → Glossary**：填入 API Key（在 [platform.deepseek.com](https://platform.deepseek.com) 获取），点击**测试连接**，然后保存。

> 兼容任何 OpenAI 风格的 `/chat/completions` 端点：在设置中修改 **API 地址** 和 **模型** 即可。

## 🚀 使用方法

| 操作 | 效果 |
|---|---|
| 在文档中选中一个词 | 在 Zotero 选词弹窗下方出现「🔍 专业名词查询」按钮 |
| 点击按钮 | 大模型在卡片中解释该术语（中文 + 英文 + 例句） |
| 选择名词本并点击 ☆ 收藏 | 术语保存到该名词本 |
| **工具 → Zotero Glossary → 专业名词本**（或 `Ctrl+Alt+B`） | 浏览名词本条目 |
| **编辑 → 设置 → Glossary → 名词本管理** | 新建 / 重命名 / 删除名词本、查看条目 |
| 设置 → **研究领域** | 如"电池、电池管理系统"——缩写优先按该领域解释 |

名词本数据保存在 Zotero 数据目录下的 `zotero-glossary.json`（可在设置中改名）。支持多个名词本，默认名词本不可删除。

## ⚙️ 设置项

- **API Key / 接口地址 / 模型 / 温度 / 超时**：大模型提供商配置。
- **研究领域**：每次查询都会携带的领域提示，让缩写优先按你的领域解释。
- **选中后显示查询按钮**：是否在选中文字时出现查询按钮。
- **选中长度限制**：触发按钮的最小/最大选中长度。
- **名词本文件名**：名词本 JSON 的保存位置。
- **名词本管理**：新建、重命名、删除名词本。

## 🛠 开发

- 环境要求：Node.js（用于 `node --check` 语法校验）和 PowerShell（`build.ps1`）。
- 构建：`powershell -ExecutionPolicy Bypass -File .\build.ps1` → 生成 `zotero-glossary.xpi`。
- 纯 JavaScript 实现，无运行时依赖；源码结构：

```
zotero-glossary/
├── manifest.json        # 插件清单（applications.zotero，支持 Zotero 7-10）
├── bootstrap.js         # 根目录生命周期入口
├── build.ps1            # 一键打包 XPI
└── addon/modules/
    ├── prefs.js         # 偏好（含研究领域）
    ├── llm.js           # 大模型客户端 + 领域提示词
    ├── glossary.js      # 多名词本存储（JSON，v2 模型）
    ├── ui.js            # 共享 UI 工具 / 样式
    ├── popup.js         # 查询卡片 + 点击式查询按钮
    ├── glossary-pane.js # 名词本浏览面板
    ├── selection.js     # 选词捕获（Zotero Reader 事件）
    ├── settings.js      # 设置面板 + 名词本管理
    └── boot.js          # 装配（工具菜单、快捷键）
```

## 📄 License

[MIT](LICENSE)
