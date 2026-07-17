# MAGI_QUORUM_SYSTEM
MAGI 决策系统 —— 一个模拟 EVA MAGI 三系统投票机制的 AI 决策工具。输入你纠结的问题，三个独立 AI 人格系统会分别从理性、道德、直觉三个角度分析并投票（赞成/否定/弃权），最终通过多数决协议给出决策结果。  MELCHIOR-01：理性分析系统 — 风险、可行性、成本收益、长期后果 BALTHASAR-02：道德评估系统 — 伦理、责任、社会影响、情感关怀 CASPAR-03：直觉判别系统 — 内心驱动、情感雷达、时机判断 支持 OpenAI / DeepSeek 等任意兼容 API，包含响应式网页版和微信小程序版。

## 功能

- **MELCHIOR-01**（理性分析系统）：从逻辑、风险、可行性、成本收益、长期后果等理性角度分析
- **BALTHASAR-02**（道德评估系统）：从伦理、责任、社会影响和情感关怀角度分析
- **CASPAR-03**（直觉判别系统）：从直觉、情感、内心驱动和时机感判断

每个系统独立分析后投票（赞成 / 否定 / 弃权），最终通过多数决协议得出决策结果。

## 技术栈

- **后端**：Node.js + Express，提供 AI API 代理（支持 OpenAI 兼容格式）
- **网页版**：单 HTML 文件，响应式适配电脑和手机
- **小程序版**：微信小程序原生开发（wxml/wxss/js）

## 快速开始

### 1. 后端

```bash
npm install
node server.js
```

后端运行在 `http://localhost:3000`，**默认 MOCK 模式**，无需 API Key 即可体验完整功能。

### 2. 网页版

浏览器打开 `http://localhost:3000/magi-decision-system.html`

### 3. 微信小程序

用微信开发者工具打开 `magi-miniprogram` 文件夹即可预览。

修改 `magi-miniprogram/pages/index/index.js` 中的 `API_BASE` 为你的后端地址。

## 启用真实 AI 分析

复制 `.env.example` 为 `.env`，取消注释并填入你的 API 信息：

```bash
cp .env.example .env
```

```env
AI_API_BASE=https://api.deepseek.com/v1   # 支持 OpenAI / DeepSeek / 通义千问 / 智谱等
AI_API_KEY=sk-your-key-here
AI_MODEL=deepseek-chat
```

保存后重启 `node server.js` 即可切换到 AI 模式。

**常见 API 配置：**

| 服务 | AI_API_BASE | AI_MODEL |
|------|-------------|----------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |

## 项目结构

```
├── server.js                    # 后端服务（AI API 代理）
├── package.json                 # 依赖配置
├── .env.example                 # 环境变量模板
├── magi-decision-system.html    # 网页版（响应式）
├── magi-miniprogram/            # 微信小程序
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── project.config.json
│   ├── sitemap.json
│   └── pages/
│       └── index/
│           ├── index.js         # 分析引擎 + 投票逻辑
│           ├── index.wxml       # 页面结构
│           ├── index.wxss       # EVA 风格样式
│           └── index.json
└── README.md
```

## License

MIT

