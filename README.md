# MAGI 决策系统

MAGI 三系统 AI 决策系统 — 理性·道德·直觉多数决投票

## 目录结构

```
MAGI_QUORUM_SYSTEM/
├── shared/
│   └── mock-engine.js          ← MOCK v4 算法（统一源码）
├── web/                        ← 网页端
│   ├── server.js               ← Express 后端
│   ├── index.html              ← CRT 风格前端
│   ├── mock-engine.js          ← MOCK 引擎（从 shared 复制）
│   ├── package.json
│   ├── .env.example
│   └── 启动MAGI.bat
├── desktop/                    ← 桌面端 (Electron)
│   ├── main.js                 ← Electron 主进程
│   ├── server.js               ← Express 后端
│   ├── index.html              ← CRT 风格前端
│   ├── mock-engine.js          ← MOCK 引擎（从 shared 复制）
│   ├── package.json
│   └── .env.example
├── android/                    ← 安卓端 (Capacitor)
│   ├── www/
│   │   ├── index.html          ← 独立前端（不依赖后端）
│   │   └── mock-engine.js      ← MOCK 引擎（从 shared 复制）
│   ├── capacitor.config.ts
│   ├── package.json
│   └── android/                ← Android 原生工程
├── dist/                       ← 构建产物
│   ├── MAGI决策系统-portable/   ← Windows 便携版（v4，含 API 修复）
│   ├── MAGI决策系统-v2.0-win64.zip   ← 桌面端（含 120s 超时/重试/智能URL 修复）
│   ├── MAGI决策系统-v2.0-android.apk ← 安卓端（含全部 API 修复）
│   └── MAGI决策系统-v1.0-android.apk ← 安卓 v1（旧版，已弃用）
└── README.md
```

## 快速开始

### 网页端
```bash
cd web
npm install
npm start
# 打开 http://localhost:3000
```

### 桌面端 (Electron)
```bash
cd desktop
npm install
npm run electron
```

### 安卓端 (Capacitor)
```bash
cd android
npm install
# 构建 APK
cd android
export JAVA_HOME="C:/Users/cabtp/jdk21/jdk-21.0.11+10"
export ANDROID_HOME="C:/Users/cabtp/AppData/Local/Android/Sdk"
./gradlew assembleDebug --no-daemon
# APK 位于 android/app/build/outputs/apk/debug/app-debug.apk
```

## MOCK v4 算法

无 API 配置时自动启用 MOCK 模式，AI 调用失败时自动降级。

### 特性
- **8 大领域检测**：职业 / 财务 / 人际 / 健康 / 教育 / 生活方式 / 科技 / 法律
- **5 维情感分析**：正面词、负面词、风险词、紧急词、成本词
- **强度修饰词**：非常 / 特别 / 极其 / 超级 → 放大情感权重
- **三系统独立投票**：MELCHIOR（理性）/ BALTHASAR（道德）/ CASPAR（直觉）各有不同权重
- **置信度评分**：每个系统输出 0-100% 置信度
- **组合式文本生成**：15 主模板 × 8 修饰 × 8 领域注解 = 8640+ 种组合
- **确定性**：同一问题始终得到相同投票，文本一致

### 算法升级历史
| 版本 | 模板数 | 特性 |
|------|--------|------|
| v1.0 | 6 | 固定模板，字符码哈希选择 |
| v2.0 | 36 | 领域检测 + 情感分析 + 独立投票 |
| v3.0 | 5184 | 组合式文本（主模板+修饰+领域注解） |
| v4.0 | 8640+ | 新增科技/法律领域 + 强度修饰 + 置信度 |

## AI API 配置

支持 OpenAI 兼容格式（DeepSeek / OpenAI / 智谱 / Moonshot 等）。

### 方式一：界面内配置
点击右上角 ⚙ 按钮，填写 API Base URL / API Key / Model。

### 方式二：环境变量
```bash
# web/.env 或 desktop/.env
AI_API_BASE=https://api.deepseek.com/v1
AI_API_KEY=sk-xxxxxxxxxxxx
AI_MODEL=deepseek-chat
```

## 降级机制

- 无 API 配置 → MOCK 模式（开箱即用）
- AI 调用失败 → 自动降级 MOCK + 警告提示
- 网页端/桌面端：MOCK 在服务端运行
- 安卓端：MOCK 在客户端运行（独立运行，不需要后端）
