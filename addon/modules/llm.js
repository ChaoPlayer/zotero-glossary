/*
 * Zotero Glossary — LLM client.
 *
 * Calls any OpenAI-compatible /chat/completions endpoint (DeepSeek by
 * default) and asks the model to explain a technical term, returning a
 * normalized entry: { term, zh, en, category, example }.
 */
"use strict";

/* global ZG, Zotero */

ZG.llm = (() => {
  const SYSTEM_PROMPT =
    "You are a scholarly terminology assistant. Given a technical term (and " +
    "optionally a bit of context), explain it for a graduate student reading " +
    "research literature. Reply with ONLY a JSON object (no markdown fence) " +
    "with exactly these keys:\n" +
    '{"term": string (the term itself), "zh": string (中文解释，2-4 句，准确而简洁), ' +
    '"en": string (concise English definition, 1-2 sentences), ' +
    '"category": string (所属学科/领域，如 化学、材料科学、生物学、机器学习，用中文), ' +
    '"example": string (一个包含该术语的英文例句)}';

  /** Build the normalized prompt for one term. */
  function buildMessages(term, context) {
    const fields = ZG.prefs.get("researchFields");
    const fieldsLine = fields && fields.trim()
      ? `\n研究领域：${fields.trim()}。优先从该领域出发解释术语；如果术语是缩写/首字母缩略词，优先给出该领域内的含义，若在其他领域有更常见的含义也请补充说明。`
      : "";
    const user = context && context.trim()
      ? `Term: ${term}\n\nContext (from the paper): ${context.trim().slice(0, 2000)}`
      : `Term: ${term}`;
    return [
      { role: "system", content: SYSTEM_PROMPT + fieldsLine },
      { role: "user", content: user },
    ];
  }

  /** Robust JSON extraction from model output. */
  function extractJson(text) {
    if (!text) throw new Error("空响应");
    const t = String(text).trim();
    try {
      return JSON.parse(t);
    } catch (_) {
      const m = t.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          return JSON.parse(m[0]);
        } catch (_) {
          /* fall through */
        }
      }
      throw new Error("模型返回的不是有效 JSON");
    }
  }

  /**
   * Look up `term` via the configured LLM.
   * @returns {Promise<{term:string, zh:string, en:string, category:string, example:string}>}
   */
  async function lookup(term, context) {
    const p = ZG.prefs;
    const apiKey = p.get("apiKey");
    if (!apiKey) {
      const err = new Error("尚未配置 API Key");
      err.code = "NO_API_KEY";
      throw err;
    }

    let base = p.get("apiBase").trim().replace(/\/+$/, "");
    if (!base) base = "https://api.deepseek.com";
    const url = `${base}/chat/completions`;

    const body = {
      model: p.get("model"),
      messages: buildMessages(term, context),
      temperature: Number(p.get("temperature")) || 0.3,
      stream: false,
      // json_object mode is supported by DeepSeek; other OpenAI-compatible
      // endpoints ignore unknown fields or may reject it, so we tolerate a
      // 4xx by retrying once without it.
      response_format: { type: "json_object" },
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    let resp;
    try {
      resp = await Zotero.HTTP.request("POST", url, {
        body: JSON.stringify(body),
        headers,
        responseType: "json",
        timeout: Number(p.get("timeoutMs")) || 60000,
      });
    } catch (e) {
      // Network-level failure.
      const err = new Error(`请求失败: ${e && e.message ? e.message : e}`);
      err.code = "NETWORK";
      throw err;
    }

    // Some OpenAI-compatible gateways reject response_format; retry once plain.
    if (resp.status >= 400) {
      const errInfo = resp.response && resp.response.error
        ? JSON.stringify(resp.response.error)
        : "";
      const formatRelated = /response_format|json_object|unsupported parameter/i.test(errInfo);
      if (!formatRelated && resp.status >= 400 && resp.status < 500) {
        // Bad key / missing model etc. — report immediately.
        const err = new Error(`API 返回错误 ${resp.status}: ${errInfo || JSON.stringify(resp.response).slice(0, 500)}`);
        err.code = "API_ERROR";
        throw err;
      }
      const plain = JSON.parse(JSON.stringify(body));
      delete plain.response_format;
      resp = await Zotero.HTTP.request("POST", url, {
        body: JSON.stringify(plain),
        headers,
        responseType: "json",
        timeout: Number(p.get("timeoutMs")) || 60000,
      });
    }

    if (resp.status !== 200) {
      const detail = resp.response && resp.response.error
        ? JSON.stringify(resp.response.error)
        : JSON.stringify(resp.response).slice(0, 500);
      const err = new Error(`API 返回错误 ${resp.status}: ${detail}`);
      err.code = "API_ERROR";
      throw err;
    }

    const data = resp.response;
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;
    if (!content) {
      const err = new Error("API 响应中没有内容");
      err.code = "API_ERROR";
      throw err;
    }

    const raw = extractJson(content);
    return {
      term: (raw.term || term).trim(),
      zh: (raw.zh || "").trim(),
      en: (raw.en || "").trim(),
      category: (raw.category || "未分类").trim(),
      example: (raw.example || "").trim(),
    };
  }

  return { lookup };
})();
