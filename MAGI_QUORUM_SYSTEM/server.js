require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const AI_API_BASE = process.env.AI_API_BASE || '';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

const USE_MOCK = !AI_API_BASE || !AI_API_KEY || AI_API_KEY === 'your-api-key-here';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 构建给 AI 的 system prompt
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

// Mock 分析，用于无 API 密钥时演示
const mockResponses = [
  {
    melchior: { analysis: '从理性角度看，该决策的收益预期明确，风险处于可控区间，执行路径也已具备。成本与回报模型支持推进。', vote: 'approve' },
    balthasar: { analysis: '该决策符合基本的伦理责任，对他人和社会关系没有明显伤害，且体现了对自身的负责。', vote: 'approve' },
    caspar: { analysis: '内心对这个方向有强烈的正面信号，情感驱动力充足，直觉上认为时机合适。', vote: 'approve' }
  },
  {
    melchior: { analysis: '理性分析显示风险敞口过大，关键变量不可控，预期收益无法覆盖潜在损失。不建议执行。', vote: 'deny' },
    balthasar: { analysis: '从道德角度看，该决策可能伤害到他人或违背承诺，存在明显的伦理隐患。', vote: 'deny' },
    caspar: { analysis: '直觉上发出警告信号，内心深处存在不安，这种犹豫值得认真对待。', vote: 'deny' }
  },
  {
    melchior: { analysis: '理性评估为中性。部分条件已具备，但关键风险和收益都不够明确，需要更多信息。', vote: 'abstain' },
    balthasar: { analysis: '道德层面没有显著冲突，也不具有突出的道德增益，整体呈中性。', vote: 'abstain' },
    caspar: { analysis: '直觉信号较弱，内心没有强烈的驱动或抗拒，暂时无法做出明确判断。', vote: 'abstain' }
  },
  {
    melchior: { analysis: '收益模型良好，但成本代价偏高，可行性仅达到中等水平。需权衡后决策。', vote: 'abstain' },
    balthasar: { analysis: '对他人无明显伤害，但也没有突出的积极伦理价值。情感关怀层面持保留态度。', vote: 'abstain' },
    caspar: { analysis: '直觉上有一种期待，但伴随不安。情感层面尚未达到确信的强度。', vote: 'abstain' }
  },
  {
    melchior: { analysis: '可行性高，资源条件充足，预期收益正面。主要风险可通过分阶段执行控制。', vote: 'approve' },
    balthasar: { analysis: '该决策对他人和自身都是负责的，体现了诚信和关怀，伦理上站得住脚。', vote: 'approve' },
    caspar: { analysis: '直觉上认为这是一个值得把握的方向，内心渴望与行动一致。', vote: 'abstain' }
  },
  {
    melchior: { analysis: '短期收益可观，但长期风险未被充分考虑。理性模型偏向谨慎。', vote: 'deny' },
    balthasar: { analysis: '虽然不存在直接伤害，但过于功利的考量可能忽视了他人的感受。', vote: 'abstain' },
    caspar: { analysis: '内心有一种冲动，但伴随隐约的后悔预感。直觉建议暂停。', vote: 'deny' }
  }
];

function pickMockResult(question) {
  // 根据问题简单选择，保证同样问题结果一致
  const idx = question.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mockResponses.length;
  return mockResponses[idx];
}

function parseJsonResponse(text) {
  // 去除 markdown 代码块
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
      analysis: String(item.analysis || '分析数据缺失。').slice(0, 200),
      vote
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

app.post('/api/analyze', async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: '缺少 question 参数' });
  }

  if (USE_MOCK) {
    console.log('[MOCK] Analyzing:', question.trim());
    await new Promise(r => setTimeout(r, 1200));
    return res.json(normalizeResult(pickMockResult(question.trim())));
  }

  try {
    // 10 秒超时，防止 AI API 挂起导致前端 Failed to fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${AI_API_BASE.replace(/\/+$/, '')}/chat/completions`, {
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

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI API error:', response.status, errText);
      // 降级到 MOCK 模式，保证系统可用
      console.log('[FALLBACK] 降级到 MOCK 模式');
      const mockResult = normalizeResult(pickMockResult(question.trim()));
      mockResult.mode = 'mock_fallback';
      mockResult.fallback_reason = 'AI API 调用失败，已降级到模拟模式';
      return res.json(mockResult);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const raw = parseJsonResponse(content);
    return res.json(normalizeResult(raw));
  } catch (err) {
    console.error('Server error:', err.message);
    // 降级到 MOCK 模式
    console.log('[FALLBACK] 降级到 MOCK 模式');
    const mockResult = normalizeResult(pickMockResult(question.trim()));
    mockResult.mode = 'mock_fallback';
    mockResult.fallback_reason = err.name === 'AbortError'
      ? 'AI API 响应超时，已降级到模拟模式'
      : '服务器异常，已降级到模拟模式';
    return res.json(mockResult);
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    mode: USE_MOCK ? 'mock' : 'ai',
    model: AI_MODEL
  });
});

app.listen(PORT, () => {
  console.log(`MAGI backend running on http://localhost:${PORT}`);
  console.log(`Mode: ${USE_MOCK ? 'MOCK (set AI_API_KEY to use real AI)' : 'AI'}`);
  console.log(`Model: ${AI_MODEL}`);
});
