// ============================================================
//  MAGI 决策系统 - Web 后端服务器
//  独立运行：node server.js → http://localhost:3000
// ============================================================
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mockEngine = require('./mock-engine.js');

const app = express();
const PORT = process.env.PORT || 3000;

// ====== 设置文件路径 ======
function getSettingsPath() {
  try {
    const { app: electronApp } = require('electron');
    if (electronApp && electronApp.isReady && electronApp.isReady()) {
      return path.join(electronApp.getPath('userData'), 'magi-config.json');
    }
  } catch (e) { /* not in electron */ }
  return path.join(__dirname, 'magi-config.json');
}

function loadSettings() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) { /* ignore */ }
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save settings:', e.message);
    return false;
  }
}

let runtimeConfig = loadSettings();
let AI_API_BASE = runtimeConfig.ai_api_base || process.env.AI_API_BASE || '';
let AI_API_KEY = runtimeConfig.ai_api_key || process.env.AI_API_KEY || '';
let AI_MODEL = runtimeConfig.ai_model || process.env.AI_MODEL || 'gpt-4o-mini';
let USE_MOCK = !AI_API_BASE || !AI_API_KEY || AI_API_KEY === 'your-api-key-here';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ====== System Prompt ======
const SYSTEM_PROMPT = `你正在扮演 MAGI 三系统决策计算机。用户会提出一个需要决策的问题，请你从三个独立人格系统的角度分别分析并投票。

三个系统：
1. MELCHIOR-01（理性分析系统）：从逻辑、风险、可行性、成本收益、长期后果等理性角度分析。
2. BALTHASAR-02（道德评估系统）：从伦理、责任、社会影响和情感关怀角度分析。
3. CASPAR-03（直觉判别系统）：从直觉、情感、内心驱动和时机感判断。

每个系统独立给出：
- analysis：一段中文分析文本（100 字以内，精炼有力）。
- vote：投票结果，必须是以下三者之一：approve（承認/赞成）、deny（否定/反对）、abstain（保留/弃权）。

最终请严格按照以下 JSON 格式返回，不要包含任何其他解释文字：
{
  "melchior": { "analysis": "...", "vote": "approve|deny|abstain" },
  "balthasar": { "analysis": "...", "vote": "approve|deny|abstain" },
  "caspar": { "analysis": "...", "vote": "approve|deny|abstain" }
}`;

// ====== 辅助函数 ======
function parseJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  return JSON.parse(cleaned);
}

function computeFinal(votes) {
  const counts = { approve: 0, deny: 0, abstain: 0 };
  Object.values(votes).forEach(v => { if (counts[v] !== undefined) counts[v]++; });
  if (counts.approve >= 2) return 'approve';
  if (counts.deny >= 2) return 'deny';
  return 'abstain';
}

function normalizeResult(raw) {
  const result = { melchior: {}, balthasar: {}, caspar: {} };
  for (const key of ['melchior', 'balthasar', 'caspar']) {
    const item = raw[key] || {};
    let vote = (item.vote || 'abstain').toLowerCase().trim();
    if (!['approve', 'deny', 'abstain'].includes(vote)) vote = 'abstain';
    result[key] = {
      analysis: String(item.analysis || '分析数据缺失。').slice(0, 300),
      vote,
      confidence: typeof item.confidence === 'number' ? item.confidence : undefined
    };
  }
  result.votes = {
    melchior: result.melchior.vote,
    balthasar: result.balthasar.vote,
    caspar: result.caspar.vote
  };
  result.final_decision = computeFinal(result.votes);
  result.mode = USE_MOCK ? 'mock' : 'ai';
  return result;
}

// ====== API 路由 ======
app.post('/api/analyze', async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: '缺少 question 参数' });
  }

  if (USE_MOCK) {
    console.log('[MOCK v' + mockEngine.MOCK_VERSION + '] Analyzing:', question.trim());
    await new Promise(r => setTimeout(r, 1200));
    return res.json(normalizeResult(mockEngine.pickMockResult(question.trim())));
  }

  try {
    const apiUrl = AI_API_BASE.replace(/\/+$/, '');
    const fullUrl = apiUrl.endsWith('/v1')
      ? `${apiUrl}/chat/completions`
      : `${apiUrl}/v1/chat/completions`;

    let response = null;
    let lastErr = null;
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        console.log(`[AI] Calling (attempt ${attempt}/${MAX_RETRIES}):`, fullUrl, '| Model:', AI_MODEL);
        response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`
          },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: question.trim() }
            ],
            temperature: 0.7,
            max_tokens: 800
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) break;
        // 401/403 是认证错误，不重试
        if (response.status === 401 || response.status === 403) {
          const errText = await response.text();
          console.error('AI API auth error:', response.status, errText);
          const mockResult = normalizeResult(mockEngine.pickMockResult(question.trim()));
          mockResult.mode = 'mock_fallback';
          mockResult.fallback_reason = `AI API 认证失败(${response.status}): ${errText.slice(0,200)}`;
          return res.json(mockResult);
        }
        lastErr = new Error(`HTTP ${response.status}`);
        console.warn(`[AI] Attempt ${attempt} failed: ${response.status}, retrying...`);
      } catch (attemptErr) {
        lastErr = attemptErr;
        console.warn(`[AI] Attempt ${attempt} network error: ${attemptErr.message}, retrying...`);
      }
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 1500));
    }

    if (!response || !response.ok) {
      console.error('[FALLBACK] AI API 全部重试失败，降级到 MOCK');
      const mockResult = normalizeResult(mockEngine.pickMockResult(question.trim()));
      mockResult.mode = 'mock_fallback';
      mockResult.fallback_reason = `AI API 调用失败（已重试${MAX_RETRIES}次）: ${lastErr?.message}，已降级到模拟模式`;
      return res.json(mockResult);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const raw = parseJsonResponse(content);
    return res.json(normalizeResult(raw));
  } catch (err) {
    console.error('Server error:', err.message);
    console.error('Full error:', err.cause || err.code || JSON.stringify(err).substring(0, 500));
    console.error('Target URL was:', fullUrl);
    console.log('[FALLBACK] 降级到 MOCK 模式');
    const mockResult = normalizeResult(mockEngine.pickMockResult(question.trim()));
    mockResult.mode = 'mock_fallback';
    mockResult.fallback_reason = err.name === 'AbortError'
      ? 'AI API 响应超时（120s），已降级到模拟模式'
      : `服务器异常: ${err.message}，已降级到模拟模式`;
    return res.json(mockResult);
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    mode: USE_MOCK ? 'mock' : 'ai',
    model: AI_MODEL,
    api_base: AI_API_BASE ? AI_API_BASE.replace(/\/+$/, '') : '',
    has_key: !!AI_API_KEY && AI_API_KEY !== 'your-api-key-here'
  });
});

app.get('/api/settings', (req, res) => {
  res.json({
    ai_api_base: AI_API_BASE,
    ai_api_key: AI_API_KEY ? AI_API_KEY.slice(0, 4) + '****' + AI_API_KEY.slice(-4) : '',
    ai_model: AI_MODEL,
    is_mock: USE_MOCK
  });
});

app.post('/api/settings', (req, res) => {
  const { ai_api_base, ai_api_key, ai_model } = req.body || {};
  if (ai_api_base !== undefined) { runtimeConfig.ai_api_base = ai_api_base; AI_API_BASE = ai_api_base; }
  if (ai_api_key !== undefined && ai_api_key !== '' && !ai_api_key.includes('****')) {
    runtimeConfig.ai_api_key = ai_api_key; AI_API_KEY = ai_api_key;
  }
  if (ai_model !== undefined && ai_model !== '') { runtimeConfig.ai_model = ai_model; AI_MODEL = ai_model; }
  USE_MOCK = !AI_API_BASE || !AI_API_KEY || AI_API_KEY === 'your-api-key-here';
  const saved = saveSettings(runtimeConfig);
  res.json({ success: true, saved, mode: USE_MOCK ? 'mock' : 'ai', model: AI_MODEL });
});

// ====== 启动 ======
const server = app.listen(PORT, () => {
  console.log(`MAGI backend running on http://localhost:${PORT}`);
  console.log(`Mode: ${USE_MOCK ? 'MOCK v' + mockEngine.MOCK_VERSION : 'AI'}`);
  console.log(`Model: ${AI_MODEL}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[WARN] 端口 ${PORT} 已被占用，后端服务已在运行`);
  } else {
    console.error('[ERROR] 服务器启动失败:', err.message);
  }
});

module.exports = { app, server };
