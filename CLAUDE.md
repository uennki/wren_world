# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

**word-learner**（GPT4 单词学习）：基于 Electron + Vue 3 + TypeScript 的桌面词汇学习应用，使用 SM-2 间隔重复算法。

## 常用命令

```bash
npm run dev          # 启动开发服务器（热重载）
npm run build        # 完整构建（类型检查 + electron-vite）
npm run build:mac    # 打包 macOS 应用
npm run lint         # ESLint 检查
npm run format       # Prettier 格式化
npm run typecheck    # 全量类型检查
npm run test         # 运行 Vitest 单元测试（仅测试 SRS 算法）
npm run test:watch   # 测试监听模式
```

## 架构概览

### 三进程模型（Electron 标准）

```
Renderer (Vue UI) ←→ Preload Bridge ←→ IPC ←→ Main Process
                                               ↓
                                      SQLite (~/.word-learner/data.db)
                                      gptwords.json（词库，打包进 resources/）
```

- **`src/main/`** — 主进程：窗口管理、IPC handlers、SQLite 操作、macOS TTS（`say` 命令）
- **`src/renderer/`** — 渲染进程：Vue 3 SPA，四个 Tab（Browse / Daily / Review / Stats）
- **`src/preload/`** — 预加载脚本：安全上下文桥，将 `window.api` 暴露给渲染层
- **`src/shared/`** — 共享层：`types.ts`（类型定义）、`srs.ts`（SM-2 算法）

### 核心数据流

1. 渲染层通过 `window.api.*` 调用 IPC
2. 主进程 `src/main/ipc.ts` 注册所有 handler
3. 数据写入 SQLite（`src/main/database.ts`），词库从 `resources/gptwords.json` 加载（`src/main/wordData.ts`）

### 渲染层组织

- **`composables/`** — 状态管理（`useWords`/`useReview`/`useDaily`/`useStats`/`useTheme`），每个 Tab 对应一个 composable
- **`components/`** — 纯展示组件（`BrowseTab`、`DailyTab`、`ReviewTab`、`StatsTab` 及子组件）
- 路径别名：`@/` → `src/renderer/`

### SRS 算法（`src/shared/srs.ts`）

- 4 级评分：1=忘记 / 2=模糊 / 3=认识 / 4=熟练
- 掌握标准：repetitions ≥ 6 且 interval ≥ 21 天
- 最低 ease factor：1.3

## 安全约束

- 渲染进程无直接 Node.js 访问（`nodeIntegration: false`，`contextIsolation: true`）
- 所有 Node.js 能力必须通过 `src/preload/index.ts` 的上下文桥暴露
- 添加新 IPC 能力：在 `ipc.ts` 注册 handler → 在 `preload/index.ts` 暴露 → 在 `preload/index.d.ts` 补充类型

## 测试

当前仅 `tests/srs.test.ts` 覆盖 SM-2 算法逻辑（使用 Vitest）。新增 SRS 相关功能需同步更新该测试。
