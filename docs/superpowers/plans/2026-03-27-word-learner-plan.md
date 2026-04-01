# GPT4 单词学习 App 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Electron + Vue 3 的 macOS 单词学习桌面应用，使用 SM-2 间隔重复算法。

**Architecture:** Electron 主进程负责 SQLite 数据库操作和 gptwords.json 数据加载，通过 IPC 暴露给 Vue 3 渲染进程。渲染进程包含三个 Tab（浏览/复习/统计），使用 Composition API 组织逻辑。

**Tech Stack:** electron-vite, Vue 3, better-sqlite3, markdown-it, vitest

**Spec 文档:** `docs/superpowers/specs/2026-03-27-word-learner-design.md`

**数据来源:** https://github.com/Ceelog/DictionaryByGPT4 的 `gptwords.json`（约 17MB，8000+ 单词）

---

## 文件结构

```
word-learner/
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── index.ts               # 窗口创建、应用生命周期
│   │   ├── database.ts            # SQLite CRUD 操作
│   │   ├── wordData.ts            # gptwords.json 加载与索引
│   │   └── ipc.ts                 # IPC handler 注册
│   ├── preload/
│   │   └── index.ts               # contextBridge 暴露 API
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.ts                # Vue 入口
│   │   ├── App.vue                # 根组件（Tab 导航）
│   │   ├── composables/
│   │   │   ├── useWords.ts        # 单词数据（列表、搜索、详情）
│   │   │   ├── useReview.ts       # 复习流程状态机
│   │   │   └── useStats.ts        # 统计数据
│   │   ├── components/
│   │   │   ├── BrowseTab.vue      # 浏览页（左右两栏）
│   │   │   ├── WordList.vue       # 虚拟滚动单词列表
│   │   │   ├── WordDetail.vue     # 单词内容渲染（Markdown）
│   │   │   ├── ReviewTab.vue      # 复习页
│   │   │   ├── ReviewCard.vue     # 复习卡片（揭示前/后）
│   │   │   ├── RatingButtons.vue  # 评分按钮组
│   │   │   ├── StatsTab.vue       # 统计页
│   │   │   └── EmptyState.vue     # 空状态提示
│   │   └── assets/
│   │       └── main.css           # 全局样式
│   └── shared/
│       ├── types.ts               # 共享类型定义
│       └── srs.ts                 # SM-2 算法（纯函数，主进程和测试共用）
├── resources/
│   └── gptwords.json              # 词典数据文件
└── tests/
    ├── srs.test.ts                # SM-2 算法单元测试
    └── database.test.ts           # 数据库层单元测试
```

### 文件职责说明

| 文件 | 职责 | 备注 |
|------|------|------|
| `src/shared/srs.ts` | SM-2 算法纯函数 | 无副作用，可独立测试 |
| `src/shared/types.ts` | TypeScript 类型 | 主进程和渲染进程共用 |
| `src/main/database.ts` | SQLite 增删改查 | 封装所有数据库操作 |
| `src/main/wordData.ts` | JSON 数据加载 | 启动时调用一次 |
| `src/main/ipc.ts` | IPC 通道注册 | 桥接主进程和渲染进程 |
| `src/preload/index.ts` | API 暴露 | contextBridge 安全暴露 |
| `src/renderer/composables/*` | 业务逻辑 hooks | 每个 Tab 对应一个 composable |

---

## Task 1: 初始化项目

**Files:**
- Create: `word-learner/` 整个项目目录

- [ ] **Step 1: 用 electron-vite 脚手架创建项目**

```bash
cd /Users/zhangjitang/Desktop/claude
npm create @quick-start/electron word-learner -- --template vue-ts
cd word-learner
```

选择模板时选 `vue-ts`（Vue + TypeScript）。

- [ ] **Step 2: 安装依赖**

```bash
cd /Users/zhangjitang/Desktop/claude/word-learner
npm install better-sqlite3 markdown-it
npm install -D @types/better-sqlite3 @types/markdown-it vitest
```

- [ ] **Step 3: 验证项目能启动**

```bash
npm run dev
```

Expected: Electron 窗口弹出，显示默认模板页面。

- [ ] **Step 4: 下载 gptwords.json**

```bash
curl -o resources/gptwords.json https://raw.githubusercontent.com/Ceelog/DictionaryByGPT4/master/gptwords.json
```

验证文件大小约 17MB：
```bash
ls -lh resources/gptwords.json
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: initialize electron-vite project with dependencies"
```

---

## Task 2: 共享类型与 SM-2 算法

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/srs.ts`
- Create: `tests/srs.test.ts`

- [ ] **Step 1: 定义共享类型**

Create `src/shared/types.ts`:

```typescript
// gptwords.json 中的单条数据
export interface WordEntry {
  word: string
  content: string
}

// SQLite words_progress 表的一行
export interface WordProgress {
  word: string
  status: 'learning' | 'mastered'
  ease_factor: number
  interval: number
  repetitions: number
  due_date: string // YYYY-MM-DD
  created_at: string
  updated_at: string
}

// 复习日志
export interface ReviewLog {
  id: number
  word: string
  rating: 1 | 2 | 3 | 4
  reviewed_at: string
}

// SM-2 评分输入
export interface SRSInput {
  rating: 1 | 2 | 3 | 4
  repetitions: number
  ease_factor: number
  interval: number
}

// SM-2 评分输出
export interface SRSOutput {
  repetitions: number
  ease_factor: number
  interval: number
  due_date: string // YYYY-MM-DD
  status: 'learning' | 'mastered'
}

// 统计数据
export interface StatsData {
  total: number
  learning: number
  mastered: number
  notStarted: number
  todayReviewed: number
  todayDue: number
  streak: number
  dailyCounts: { date: string; count: number }[]
}

// 暴露给渲染进程的 API
export interface ElectronAPI {
  // 单词数据
  getWordList: () => Promise<string[]>
  getWordContent: (word: string) => Promise<string | null>
  searchWords: (query: string) => Promise<string[]>
  // 学习队列
  addToQueue: (word: string) => Promise<void>
  removeFromQueue: (word: string) => Promise<void>
  isInQueue: (word: string) => Promise<boolean>
  getQueueWords: () => Promise<string[]>
  // 复习
  getTodayReviewList: () => Promise<WordProgress[]>
  submitReview: (word: string, rating: 1 | 2 | 3 | 4) => Promise<void>
  // 统计
  getStats: () => Promise<StatsData>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
```

- [ ] **Step 2: 编写 SM-2 算法测试**

Create `tests/srs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateSRS } from '../src/shared/srs'

// Mock 日期为固定值，方便测试
function mockToday(dateStr: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(dateStr))
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('SM-2 SRS Algorithm', () => {
  describe('评分 1（忘了）', () => {
    it('should reset interval to 1 and repetitions to 0', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 1,
        repetitions: 5,
        ease_factor: 2.5,
        interval: 30
      })
      expect(result.interval).toBe(1)
      expect(result.repetitions).toBe(0)
      expect(result.due_date).toBe('2026-04-02')
    })

    it('should decrease ease_factor by 0.2 but not below 1.3', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 1,
        repetitions: 3,
        ease_factor: 1.4,
        interval: 10
      })
      expect(result.ease_factor).toBe(1.3)
    })

    it('should demote mastered word back to learning', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 1,
        repetitions: 8,
        ease_factor: 2.5,
        interval: 60
      })
      expect(result.status).toBe('learning')
    })
  })

  describe('评分 2（模糊）', () => {
    it('should reset interval to 1 and repetitions to 0', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 2,
        repetitions: 3,
        ease_factor: 2.5,
        interval: 15
      })
      expect(result.interval).toBe(1)
      expect(result.repetitions).toBe(0)
      expect(result.due_date).toBe('2026-04-02')
    })

    it('should decrease ease_factor by 0.15', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 2,
        repetitions: 3,
        ease_factor: 2.5,
        interval: 15
      })
      expect(result.ease_factor).toBe(2.35)
    })
  })

  describe('评分 3（认识）', () => {
    it('should set interval to 1 when repetitions is 0', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 3,
        repetitions: 0,
        ease_factor: 2.5,
        interval: 0
      })
      expect(result.interval).toBe(1)
      expect(result.repetitions).toBe(1)
    })

    it('should set interval to 3 when repetitions is 1', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 3,
        repetitions: 1,
        ease_factor: 2.5,
        interval: 1
      })
      expect(result.interval).toBe(3)
      expect(result.repetitions).toBe(2)
    })

    it('should multiply interval by ease_factor when repetitions >= 2', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 3,
        repetitions: 2,
        ease_factor: 2.5,
        interval: 3
      })
      expect(result.interval).toBe(8) // round(3 * 2.5) = 8
      expect(result.repetitions).toBe(3)
    })

    it('should not change ease_factor', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 3,
        repetitions: 2,
        ease_factor: 2.5,
        interval: 3
      })
      expect(result.ease_factor).toBe(2.5)
    })
  })

  describe('评分 4（熟练）', () => {
    it('should increase ease_factor by 0.15', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 4,
        repetitions: 2,
        ease_factor: 2.5,
        interval: 3
      })
      expect(result.ease_factor).toBe(2.65)
    })

    it('should calculate interval same as rating 3', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 4,
        repetitions: 2,
        ease_factor: 2.5,
        interval: 3
      })
      expect(result.interval).toBe(8) // round(3 * 2.5)
    })
  })

  describe('mastered 状态', () => {
    it('should become mastered when repetitions >= 6 and interval >= 21', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 3,
        repetitions: 5, // will become 6
        ease_factor: 2.5,
        interval: 25 // round(25 * 2.5) = 63, >= 21
      })
      expect(result.repetitions).toBe(6)
      expect(result.status).toBe('mastered')
    })

    it('should stay learning when repetitions < 6', () => {
      mockToday('2026-04-01')
      const result = calculateSRS({
        rating: 3,
        repetitions: 4,
        ease_factor: 2.5,
        interval: 30
      })
      expect(result.status).toBe('learning')
    })
  })
})
```

- [ ] **Step 3: 运行测试，确认全部失败**

```bash
npx vitest run tests/srs.test.ts
```

Expected: 全部 FAIL（`calculateSRS` 函数还不存在）。

- [ ] **Step 4: 实现 SM-2 算法**

Create `src/shared/srs.ts`:

```typescript
import type { SRSInput, SRSOutput } from './types'

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

export function calculateSRS(input: SRSInput): SRSOutput {
  const { rating, repetitions, ease_factor, interval } = input

  let newRepetitions = repetitions
  let newEaseFactor = ease_factor
  let newInterval = interval

  if (rating === 1) {
    // 忘了：重置
    newInterval = 1
    newRepetitions = 0
    newEaseFactor = Math.max(1.3, ease_factor - 0.2)
  } else if (rating === 2) {
    // 模糊：重置，惩罚略轻
    newInterval = 1
    newRepetitions = 0
    newEaseFactor = Math.max(1.3, ease_factor - 0.15)
  } else if (rating === 3) {
    // 认识：正常增长
    if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = 3
    } else {
      newInterval = Math.round(interval * ease_factor)
    }
    newRepetitions = repetitions + 1
    // ease_factor 不变（有意简化）
  } else if (rating === 4) {
    // 熟练：同认识的 interval 计算 + ease_factor 上升
    if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = 3
    } else {
      newInterval = Math.round(interval * ease_factor)
    }
    newRepetitions = repetitions + 1
    newEaseFactor = ease_factor + 0.15
  }

  // 判断是否 mastered
  const status =
    newRepetitions >= 6 && newInterval >= 21 ? 'mastered' : 'learning'

  return {
    repetitions: newRepetitions,
    ease_factor: newEaseFactor,
    interval: newInterval,
    due_date: addDays(newInterval),
    status
  }
}

export function getToday(): string {
  return formatDate(new Date())
}

export function getTomorrow(): string {
  return addDays(1)
}
```

- [ ] **Step 5: 运行测试，确认全部通过**

```bash
npx vitest run tests/srs.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/srs.ts tests/srs.test.ts
git commit -m "feat: add shared types and SM-2 SRS algorithm with tests"
```

---

## Task 3: 数据库层

**Files:**
- Create: `src/main/database.ts`

- [ ] **Step 1: 实现数据库层**

Create `src/main/database.ts`:

```typescript
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { calculateSRS, getToday, getTomorrow } from '../shared/srs'
import type { WordProgress, StatsData } from '../shared/types'

let db: Database.Database

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('home'), '.word-learner', 'data.db')

  // 确保目录存在
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // 建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS words_progress (
      word        TEXT PRIMARY KEY,
      status      TEXT DEFAULT 'learning',
      ease_factor REAL DEFAULT 2.5,
      interval    INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      due_date    TEXT,
      created_at  TEXT,
      updated_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS review_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      word        TEXT,
      rating      INTEGER,
      reviewed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_due_date
    ON words_progress(due_date);
  `)
}

export function addToQueue(word: string): void {
  const now = new Date().toISOString()
  const tomorrow = getTomorrow()
  db.prepare(`
    INSERT OR IGNORE INTO words_progress
    (word, status, ease_factor, interval, repetitions, due_date, created_at, updated_at)
    VALUES (?, 'learning', 2.5, 0, 0, ?, ?, ?)
  `).run(word, tomorrow, now, now)
}

export function removeFromQueue(word: string): void {
  db.prepare('DELETE FROM words_progress WHERE word = ?').run(word)
}

export function isInQueue(word: string): boolean {
  const row = db.prepare('SELECT 1 FROM words_progress WHERE word = ?').get(word)
  return !!row
}

export function getQueueWords(): string[] {
  const rows = db.prepare(
    'SELECT word FROM words_progress ORDER BY created_at'
  ).all() as { word: string }[]
  return rows.map(r => r.word)
}

export function getTodayReviewList(): WordProgress[] {
  const today = getToday()
  return db.prepare(`
    SELECT * FROM words_progress
    WHERE due_date <= ?
    ORDER BY due_date ASC, ease_factor ASC
  `).all(today) as WordProgress[]
}

export function submitReview(word: string, rating: 1 | 2 | 3 | 4): void {
  const now = new Date().toISOString()

  // 查询当前状态
  const current = db.prepare(
    'SELECT * FROM words_progress WHERE word = ?'
  ).get(word) as WordProgress | undefined

  if (!current) return

  // 计算新的 SRS 值
  const result = calculateSRS({
    rating,
    repetitions: current.repetitions,
    ease_factor: current.ease_factor,
    interval: current.interval
  })

  // 更新 words_progress
  db.prepare(`
    UPDATE words_progress
    SET status = ?, ease_factor = ?, interval = ?,
        repetitions = ?, due_date = ?, updated_at = ?
    WHERE word = ?
  `).run(
    result.status, result.ease_factor, result.interval,
    result.repetitions, result.due_date, now, word
  )

  // 写入复习日志
  db.prepare(`
    INSERT INTO review_log (word, rating, reviewed_at)
    VALUES (?, ?, ?)
  `).run(word, rating, now)
}

export function getStats(totalWords: number): StatsData {
  const today = getToday()

  const learning = (db.prepare(
    "SELECT COUNT(*) as c FROM words_progress WHERE status = 'learning'"
  ).get() as { c: number }).c

  const mastered = (db.prepare(
    "SELECT COUNT(*) as c FROM words_progress WHERE status = 'mastered'"
  ).get() as { c: number }).c

  const todayReviewed = (db.prepare(
    "SELECT COUNT(*) as c FROM review_log WHERE date(reviewed_at) = ?"
  ).get(today) as { c: number }).c

  const todayDue = (db.prepare(
    "SELECT COUNT(*) as c FROM words_progress WHERE due_date <= ?"
  ).get(today) as { c: number }).c

  // 近 30 天每日复习量
  const dailyCounts = db.prepare(`
    SELECT date(reviewed_at) as date, COUNT(*) as count
    FROM review_log
    WHERE date(reviewed_at) >= date('now', '-30 days')
    GROUP BY date(reviewed_at)
    ORDER BY date ASC
  `).all() as { date: string; count: number }[]

  // 连续学习天数
  const streak = calculateStreak()

  return {
    total: totalWords,
    learning,
    mastered,
    notStarted: totalWords - learning - mastered,
    todayReviewed,
    todayDue,
    streak,
    dailyCounts
  }
}

function calculateStreak(): number {
  const dates = db.prepare(`
    SELECT DISTINCT date(reviewed_at) as d
    FROM review_log
    ORDER BY d DESC
  `).all() as { d: string }[]

  if (dates.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    const expectedStr = expected.toISOString().split('T')[0]

    if (dates[i].d === expectedStr) {
      streak++
    } else {
      break
    }
  }

  return streak
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/database.ts
git commit -m "feat: implement SQLite database layer with SRS integration"
```

---

## Task 4: 数据加载与 IPC 通信

**Files:**
- Create: `src/main/wordData.ts`
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 实现数据加载**

Create `src/main/wordData.ts`:

```typescript
import fs from 'fs'
import path from 'path'
import type { WordEntry } from '../shared/types'

let wordList: string[] = []
let wordMap: Map<string, string> = new Map()

export function loadWordData(): void {
  // 开发环境和生产环境的路径不同
  const possiblePaths = [
    path.join(__dirname, '../../resources/gptwords.json'),
    path.join(process.resourcesPath, 'gptwords.json')
  ]

  let rawData: string | null = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      rawData = fs.readFileSync(p, 'utf-8')
      break
    }
  }

  if (!rawData) {
    throw new Error('gptwords.json not found')
  }

  // gptwords.json 是 NDJSON 格式（每行一个 JSON 对象，无数组包裹）
  // 注意：如果实际文件是标准 JSON 数组 [{...},{...}]，
  // 则改为：const entries = JSON.parse(rawData) as WordEntry[]
  // 然后 entries.forEach(entry => wordMap.set(entry.word, entry.content))
  const lines = rawData.split('\n').filter(line => line.trim())
  for (const line of lines) {
    try {
      const entry: WordEntry = JSON.parse(line)
      wordMap.set(entry.word, entry.content)
    } catch {
      // 跳过解析失败的行
    }
  }

  wordList = Array.from(wordMap.keys()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )
}

export function getWordList(): string[] {
  return wordList
}

export function getWordContent(word: string): string | null {
  return wordMap.get(word) ?? null
}

export function searchWords(query: string): string[] {
  if (!query) return wordList
  const lower = query.toLowerCase()
  return wordList.filter(w => w.toLowerCase().includes(lower))
}

export function getTotalCount(): number {
  return wordList.length
}
```

> **重要提示**：从 curl 下载的 gptwords.json 实际是 NDJSON 格式（每行一个 JSON 对象），不是标准 JSON 数组。上面的代码按行解析。请在实现时先检查文件的实际格式（`head -c 100 resources/gptwords.json`），如果文件以 `[` 开头则是 JSON 数组，需要改用 `JSON.parse(rawData)`。

- [ ] **Step 2: 注册 IPC handlers**

Create `src/main/ipc.ts`:

```typescript
import { ipcMain } from 'electron'
import * as wordData from './wordData'
import * as database from './database'

export function registerIPC(): void {
  // 单词数据
  ipcMain.handle('get-word-list', () => wordData.getWordList())
  ipcMain.handle('get-word-content', (_, word: string) =>
    wordData.getWordContent(word)
  )
  ipcMain.handle('search-words', (_, query: string) =>
    wordData.searchWords(query)
  )

  // 学习队列
  ipcMain.handle('add-to-queue', (_, word: string) =>
    database.addToQueue(word)
  )
  ipcMain.handle('remove-from-queue', (_, word: string) =>
    database.removeFromQueue(word)
  )
  ipcMain.handle('is-in-queue', (_, word: string) =>
    database.isInQueue(word)
  )
  ipcMain.handle('get-queue-words', () => database.getQueueWords())

  // 复习
  ipcMain.handle('get-today-review-list', () =>
    database.getTodayReviewList()
  )
  ipcMain.handle(
    'submit-review',
    (_, word: string, rating: 1 | 2 | 3 | 4) =>
      database.submitReview(word, rating)
  )

  // 统计
  ipcMain.handle('get-stats', () =>
    database.getStats(wordData.getTotalCount())
  )
}
```

- [ ] **Step 3: 更新 preload 脚本**

Rewrite `src/preload/index.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../shared/types'

const api: ElectronAPI = {
  getWordList: () => ipcRenderer.invoke('get-word-list'),
  getWordContent: (word) => ipcRenderer.invoke('get-word-content', word),
  searchWords: (query) => ipcRenderer.invoke('search-words', query),
  addToQueue: (word) => ipcRenderer.invoke('add-to-queue', word),
  removeFromQueue: (word) => ipcRenderer.invoke('remove-from-queue', word),
  isInQueue: (word) => ipcRenderer.invoke('is-in-queue', word),
  getQueueWords: () => ipcRenderer.invoke('get-queue-words'),
  getTodayReviewList: () => ipcRenderer.invoke('get-today-review-list'),
  submitReview: (word, rating) =>
    ipcRenderer.invoke('submit-review', word, rating),
  getStats: () => ipcRenderer.invoke('get-stats')
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 4: 更新主进程入口**

Rewrite `src/main/index.ts`:

```typescript
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './database'
import { loadWordData } from './wordData'
import { registerIPC } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: 'GPT4 单词学习',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.word-learner')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 初始化数据
  initDatabase()
  loadWordData()
  registerIPC()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

- [ ] **Step 5: 验证应用能启动（不报错）**

```bash
npm run dev
```

Expected: Electron 窗口弹出，控制台无报错。

- [ ] **Step 6: Commit**

```bash
git add src/main/ src/preload/index.ts
git commit -m "feat: implement data loading, IPC communication, and database init"
```

---

## Task 5: Vue 渲染层 — App 根组件与 Tab 导航

**Files:**
- Modify: `src/renderer/App.vue`
- Modify: `src/renderer/main.ts`
- Create: `src/renderer/assets/main.css`

- [ ] **Step 1: 全局样式**

Create `src/renderer/assets/main.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-card: #0f3460;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --accent: #e94560;
  --accent-hover: #ff6b81;
  --success: #4ecca3;
  --warning: #ffc857;
  --border: #2a2a4a;
  --font-mono: 'SF Mono', 'Fira Code', monospace;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  height: 100vh;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Tab 导航 */
.tab-nav {
  display: flex;
  gap: 0;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  -webkit-app-region: drag;
  height: 44px;
  align-items: stretch;
}

.tab-nav button {
  -webkit-app-region: no-drag;
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 0 20px;
  font-size: 14px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-nav button:hover {
  color: var(--text-primary);
}

.tab-nav button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-content {
  flex: 1;
  overflow: hidden;
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 按钮通用 */
.btn {
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.btn-outline:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* Markdown 内容样式 */
.markdown-content h3 {
  color: var(--accent);
  margin: 20px 0 10px;
  font-size: 16px;
}

.markdown-content p {
  line-height: 1.8;
  margin: 8px 0;
}

.markdown-content ol,
.markdown-content ul {
  padding-left: 20px;
  margin: 8px 0;
}

.markdown-content li {
  line-height: 1.8;
  margin: 4px 0;
}

.markdown-content code {
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 13px;
}
```

- [ ] **Step 2: 更新 Vue 入口**

Modify `src/renderer/main.ts`:

```typescript
import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'

createApp(App).mount('#app')
```

- [ ] **Step 3: 实现 App 根组件（Tab 导航）**

Rewrite `src/renderer/App.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BrowseTab from './components/BrowseTab.vue'
import ReviewTab from './components/ReviewTab.vue'
import StatsTab from './components/StatsTab.vue'

const activeTab = ref<'browse' | 'review' | 'stats'>('browse')
const reviewCount = ref(0)

async function refreshReviewCount() {
  const list = await window.api.getTodayReviewList()
  reviewCount.value = list.length
}

onMounted(() => {
  refreshReviewCount()
})
</script>

<template>
  <div class="tab-nav">
    <button
      :class="{ active: activeTab === 'browse' }"
      @click="activeTab = 'browse'"
    >
      浏览
    </button>
    <button
      :class="{ active: activeTab === 'review' }"
      @click="activeTab = 'review'; refreshReviewCount()"
    >
      今日复习 {{ reviewCount > 0 ? reviewCount : '' }}
    </button>
    <button
      :class="{ active: activeTab === 'stats' }"
      @click="activeTab = 'stats'"
    >
      统计
    </button>
  </div>

  <div class="tab-content">
    <BrowseTab v-if="activeTab === 'browse'" @queue-changed="refreshReviewCount" />
    <ReviewTab v-if="activeTab === 'review'" @review-done="refreshReviewCount" />
    <StatsTab v-if="activeTab === 'stats'" />
  </div>
</template>
```

- [ ] **Step 4: 创建三个占位组件**

先创建空组件让项目能编译。

Create `src/renderer/components/BrowseTab.vue`:
```vue
<script setup lang="ts">
defineEmits<{ 'queue-changed': [] }>()
</script>
<template>
  <div style="padding: 20px;">浏览（待实现）</div>
</template>
```

Create `src/renderer/components/ReviewTab.vue`:
```vue
<script setup lang="ts">
defineEmits<{ 'review-done': [] }>()
</script>
<template>
  <div style="padding: 20px;">复习（待实现）</div>
</template>
```

Create `src/renderer/components/StatsTab.vue`:
```vue
<template>
  <div style="padding: 20px;">统计（待实现）</div>
</template>
```

- [ ] **Step 5: 验证 Tab 切换正常**

```bash
npm run dev
```

Expected: 窗口显示三个 Tab，点击可切换，暗色主题。

- [ ] **Step 6: Commit**

```bash
git add src/renderer/
git commit -m "feat: implement App shell with tab navigation and dark theme"
```

---

## Task 6: 浏览 Tab

**Files:**
- Rewrite: `src/renderer/components/BrowseTab.vue`
- Create: `src/renderer/components/WordList.vue`
- Create: `src/renderer/components/WordDetail.vue`
- Create: `src/renderer/composables/useWords.ts`

- [ ] **Step 1: 实现 useWords composable**

Create `src/renderer/composables/useWords.ts`:

```typescript
import { ref, computed } from 'vue'

const allWords = ref<string[]>([])
const searchQuery = ref('')
const selectedWord = ref<string | null>(null)
const selectedContent = ref<string | null>(null)
const queueSet = ref<Set<string>>(new Set())
let loaded = false

export function useWords() {
  async function loadWords() {
    if (loaded) return
    allWords.value = await window.api.getWordList()
    const queueWords = await window.api.getQueueWords()
    queueSet.value = new Set(queueWords)
    loaded = true
  }

  const filteredWords = computed(() => {
    if (!searchQuery.value) return allWords.value
    const q = searchQuery.value.toLowerCase()
    return allWords.value.filter(w => w.toLowerCase().includes(q))
  })

  async function selectWord(word: string) {
    selectedWord.value = word
    selectedContent.value = await window.api.getWordContent(word)
  }

  async function toggleQueue(word: string) {
    if (queueSet.value.has(word)) {
      await window.api.removeFromQueue(word)
      queueSet.value.delete(word)
    } else {
      await window.api.addToQueue(word)
      queueSet.value.add(word)
    }
  }

  function isInQueue(word: string): boolean {
    return queueSet.value.has(word)
  }

  return {
    allWords,
    searchQuery,
    selectedWord,
    selectedContent,
    filteredWords,
    loadWords,
    selectWord,
    toggleQueue,
    isInQueue
  }
}
```

- [ ] **Step 2: 实现虚拟滚动单词列表**

Create `src/renderer/components/WordList.vue`:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{
  words: string[]
  selectedWord: string | null
  queueChecker: (word: string) => boolean
}>()

const emit = defineEmits<{
  select: [word: string]
}>()

// 简单虚拟滚动
const ITEM_HEIGHT = 36
const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(500)

const visibleRange = computed(() => {
  const start = Math.floor(scrollTop.value / ITEM_HEIGHT)
  const count = Math.ceil(containerHeight.value / ITEM_HEIGHT) + 2
  return {
    start: Math.max(0, start - 1),
    end: Math.min(props.words.length, start + count)
  }
})

const visibleItems = computed(() => {
  return props.words.slice(visibleRange.value.start, visibleRange.value.end)
})

const totalHeight = computed(() => props.words.length * ITEM_HEIGHT)
const offsetY = computed(() => visibleRange.value.start * ITEM_HEIGHT)

function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLElement).scrollTop
}

onMounted(() => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="word-list"
    @scroll="onScroll"
    tabindex="0"
  >
    <div :style="{ height: totalHeight + 'px', position: 'relative' }">
      <div :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="word in visibleItems"
          :key="word"
          class="word-item"
          :class="{
            selected: word === selectedWord,
            'in-queue': queueChecker(word)
          }"
          @click="emit('select', word)"
        >
          <span class="dot">{{ queueChecker(word) ? '●' : '○' }}</span>
          <span class="word-text">{{ word }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.word-list {
  height: 100%;
  overflow-y: auto;
  outline: none;
}

.word-item {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: pointer;
  font-size: 14px;
  gap: 8px;
}

.word-item:hover {
  background: var(--bg-card);
}

.word-item.selected {
  background: var(--bg-card);
  border-left: 2px solid var(--accent);
}

.dot {
  font-size: 10px;
  color: var(--text-secondary);
}

.word-item.in-queue .dot {
  color: var(--accent);
}

.word-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

- [ ] **Step 3: 实现单词详情组件**

Create `src/renderer/components/WordDetail.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  word: string | null
  content: string | null
  inQueue: boolean
}>()

const emit = defineEmits<{
  'toggle-queue': []
}>()

const md = new MarkdownIt()

const renderedContent = computed(() => {
  if (!props.content) return ''
  return md.render(props.content)
})
</script>

<template>
  <div class="word-detail" v-if="word">
    <div class="detail-header">
      <h1>{{ word }}</h1>
      <button
        class="btn"
        :class="inQueue ? 'btn-outline' : 'btn-primary'"
        @click="emit('toggle-queue')"
      >
        {{ inQueue ? '移出队列' : '+ 加入学习队列' }}
      </button>
    </div>
    <div class="detail-body">
      <div class="markdown-content" v-html="renderedContent" />
    </div>
  </div>
  <div class="word-detail empty" v-else>
    <p>选择左侧单词查看详情</p>
  </div>
</template>

<style scoped>
.word-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.word-detail.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.detail-header h1 {
  font-size: 24px;
  font-weight: 600;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
</style>
```

- [ ] **Step 4: 组装浏览 Tab**

Rewrite `src/renderer/components/BrowseTab.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useWords } from '../composables/useWords'
import WordList from './WordList.vue'
import WordDetail from './WordDetail.vue'

const emit = defineEmits<{ 'queue-changed': [] }>()

const {
  searchQuery,
  selectedWord,
  selectedContent,
  filteredWords,
  loadWords,
  selectWord,
  toggleQueue,
  isInQueue
} = useWords()

const searchInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await loadWords()
  // Cmd+F 快捷键
  window.addEventListener('keydown', (e) => {
    if (e.metaKey && e.key === 'f') {
      e.preventDefault()
      searchInput.value?.focus()
    }
  })
})

async function handleToggleQueue() {
  if (selectedWord.value) {
    await toggleQueue(selectedWord.value)
    emit('queue-changed')
  }
}
</script>

<template>
  <div class="browse-tab">
    <div class="left-panel">
      <div class="search-box">
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="搜索单词..."
          class="search-input"
        />
      </div>
      <WordList
        :words="filteredWords"
        :selected-word="selectedWord"
        :queue-checker="isInQueue"
        @select="selectWord"
      />
    </div>
    <div class="right-panel">
      <WordDetail
        :word="selectedWord"
        :content="selectedContent"
        :in-queue="selectedWord ? isInQueue(selectedWord) : false"
        @toggle-queue="handleToggleQueue"
      />
    </div>
  </div>
</template>

<style scoped>
.browse-tab {
  display: flex;
  height: 100%;
}

.left-panel {
  width: 250px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.search-box {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.search-input:focus {
  border-color: var(--accent);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.right-panel {
  flex: 1;
}
</style>
```

- [ ] **Step 5: 验证浏览功能**

```bash
npm run dev
```

Expected:
- 左侧显示 8000 个词，滚动流畅
- 搜索能实时过滤
- 点击单词右侧显示 Markdown 内容
- "加入学习队列"按钮可用，列表标记变化

- [ ] **Step 6: Commit**

```bash
git add src/renderer/
git commit -m "feat: implement Browse tab with virtual scrolling and word detail"
```

---

## Task 7: 复习 Tab

**Files:**
- Create: `src/renderer/composables/useReview.ts`
- Create: `src/renderer/components/ReviewCard.vue`
- Create: `src/renderer/components/RatingButtons.vue`
- Create: `src/renderer/components/EmptyState.vue`
- Rewrite: `src/renderer/components/ReviewTab.vue`

- [ ] **Step 1: 实现 useReview composable**

Create `src/renderer/composables/useReview.ts`:

```typescript
import { ref, computed } from 'vue'
import MarkdownIt from 'markdown-it'
import type { WordProgress } from '../../shared/types'

const md = new MarkdownIt()

export function useReview() {
  const reviewList = ref<WordProgress[]>([])
  const currentIndex = ref(0)
  const revealed = ref(false)
  const currentContent = ref<string | null>(null)
  const sessionDone = ref(0)
  const finished = ref(false)

  const currentWord = computed(() => {
    if (currentIndex.value >= reviewList.value.length) return null
    return reviewList.value[currentIndex.value]
  })

  const renderedContent = computed(() => {
    if (!currentContent.value) return ''
    return md.render(currentContent.value)
  })

  const totalCount = computed(() => reviewList.value.length)
  const remaining = computed(() =>
    Math.max(0, totalCount.value - currentIndex.value)
  )

  async function loadReviewList() {
    reviewList.value = await window.api.getTodayReviewList()
    currentIndex.value = 0
    revealed.value = false
    finished.value = reviewList.value.length === 0
    sessionDone.value = 0

    if (reviewList.value.length > 0) {
      await loadCurrentContent()
    }
  }

  async function loadCurrentContent() {
    if (!currentWord.value) return
    currentContent.value = await window.api.getWordContent(
      currentWord.value.word
    )
  }

  function reveal() {
    if (!currentWord.value || revealed.value) return
    revealed.value = true
  }

  async function rate(rating: 1 | 2 | 3 | 4) {
    if (!currentWord.value || !revealed.value) return

    await window.api.submitReview(currentWord.value.word, rating)
    sessionDone.value++

    // 移动到下一个
    currentIndex.value++
    revealed.value = false
    currentContent.value = null

    if (currentIndex.value >= reviewList.value.length) {
      finished.value = true
    } else {
      await loadCurrentContent()
    }
  }

  return {
    currentWord,
    revealed,
    renderedContent,
    totalCount,
    remaining,
    sessionDone,
    finished,
    loadReviewList,
    reveal,
    rate
  }
}
```

- [ ] **Step 2: 实现评分按钮组件**

Create `src/renderer/components/RatingButtons.vue`:

```vue
<script setup lang="ts">
import type { WordProgress } from '../../shared/types'

defineProps<{
  word: WordProgress
}>()

const emit = defineEmits<{
  rate: [rating: 1 | 2 | 3 | 4]
}>()

// 简单预估下次间隔（显示用）
function estimateInterval(
  current: WordProgress,
  rating: number
): string {
  if (rating <= 2) return '1天'
  let interval: number
  if (current.repetitions === 0) interval = 1
  else if (current.repetitions === 1) interval = 3
  else interval = Math.round(current.interval * current.ease_factor)
  return interval >= 30
    ? `${Math.round(interval / 30)}月`
    : `${interval}天`
}

const buttons = [
  { rating: 1 as const, label: '忘了', color: '#e94560' },
  { rating: 2 as const, label: '模糊', color: '#ffc857' },
  { rating: 3 as const, label: '认识', color: '#4ecca3' },
  { rating: 4 as const, label: '熟练', color: '#4ea8de' }
]
</script>

<template>
  <div class="rating-buttons">
    <button
      v-for="btn in buttons"
      :key="btn.rating"
      class="rating-btn"
      :style="{ borderColor: btn.color, color: btn.color }"
      @click="emit('rate', btn.rating)"
    >
      <span class="rating-label">{{ btn.label }}</span>
      <span class="rating-interval">
        {{ estimateInterval(word, btn.rating) }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.rating-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 20px;
}

.rating-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 24px;
  background: transparent;
  border: 2px solid;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}

.rating-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}

.rating-label {
  font-size: 16px;
  font-weight: 600;
}

.rating-interval {
  font-size: 12px;
  opacity: 0.7;
}
</style>
```

- [ ] **Step 3: 实现空状态组件**

Create `src/renderer/components/EmptyState.vue`:

```vue
<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>

<template>
  <div class="empty-state">
    <p>{{ message }}</p>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-size: 18px;
}
</style>
```

- [ ] **Step 4: 实现复习卡片组件**

Create `src/renderer/components/ReviewCard.vue`:

```vue
<script setup lang="ts">
defineProps<{
  word: string
  revealed: boolean
  renderedContent: string
}>()

const emit = defineEmits<{
  reveal: []
}>()
</script>

<template>
  <div class="review-card">
    <div class="card-word">
      <h1>{{ word }}</h1>
    </div>

    <div v-if="!revealed" class="card-prompt" @click="emit('reveal')">
      <p>点击揭示 / 按空格键</p>
    </div>

    <div v-else class="card-content">
      <div class="markdown-content" v-html="renderedContent" />
    </div>
  </div>
</template>

<style scoped>
.review-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-word {
  text-align: center;
  padding: 40px 20px 20px;
}

.card-word h1 {
  font-size: 36px;
  font-weight: 700;
}

.card-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 16px;
}

.card-prompt:hover {
  color: var(--text-primary);
}

.card-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 40px 20px;
}
</style>
```

- [ ] **Step 5: 组装复习 Tab**

Rewrite `src/renderer/components/ReviewTab.vue`:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useReview } from '../composables/useReview'
import ReviewCard from './ReviewCard.vue'
import RatingButtons from './RatingButtons.vue'
import EmptyState from './EmptyState.vue'

const emit = defineEmits<{ 'review-done': [] }>()

const {
  currentWord,
  revealed,
  renderedContent,
  totalCount,
  remaining,
  sessionDone,
  finished,
  loadReviewList,
  reveal,
  rate
} = useReview()

async function handleRate(rating: 1 | 2 | 3 | 4) {
  await rate(rating)
  emit('review-done')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === ' ' && !revealed.value && currentWord.value) {
    e.preventDefault()
    reveal()
  } else if (
    revealed.value &&
    ['1', '2', '3', '4'].includes(e.key)
  ) {
    e.preventDefault()
    handleRate(Number(e.key) as 1 | 2 | 3 | 4)
  }
}

onMounted(async () => {
  await loadReviewList()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="review-tab">
    <!-- 无待复习 -->
    <EmptyState
      v-if="totalCount === 0 && !finished"
      message="没有待复习的单词，去浏览页添加吧"
    />

    <!-- 复习完成 -->
    <EmptyState
      v-else-if="finished && sessionDone > 0"
      message="今日复习完成"
    />

    <!-- 复习进行中 -->
    <template v-else-if="currentWord">
      <div class="review-header">
        <span>待复习：{{ remaining }}</span>
        <span>已完成：{{ sessionDone }}</span>
      </div>

      <ReviewCard
        :word="currentWord.word"
        :revealed="revealed"
        :rendered-content="renderedContent"
        @reveal="reveal"
      />

      <RatingButtons
        v-if="revealed"
        :word="currentWord"
        @rate="handleRate"
      />
    </template>
  </div>
</template>

<style scoped>
.review-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.review-header {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 12px;
  color: var(--text-secondary);
  font-size: 14px;
  border-bottom: 1px solid var(--border);
}
</style>
```

- [ ] **Step 6: 验证复习功能**

```bash
npm run dev
```

验证步骤：
1. 在浏览 Tab 添加几个词到队列
2. 由于新词 due_date 是明天，需要手动修改测试：
   `sqlite3 ~/.word-learner/data.db "UPDATE words_progress SET due_date = date('now')"`
3. 切换到复习 Tab，看到待复习列表
4. 空格揭示 → 按 1/2/3/4 评分 → 自动跳下一个
5. 全部完成后显示"复习完成"

- [ ] **Step 7: Commit**

```bash
git add src/renderer/
git commit -m "feat: implement Review tab with SRS flow and keyboard shortcuts"
```

---

## Task 8: 统计 Tab

**Files:**
- Create: `src/renderer/composables/useStats.ts`
- Rewrite: `src/renderer/components/StatsTab.vue`

- [ ] **Step 1: 实现 useStats composable**

Create `src/renderer/composables/useStats.ts`:

```typescript
import { ref } from 'vue'
import type { StatsData } from '../../shared/types'

export function useStats() {
  const stats = ref<StatsData | null>(null)

  async function loadStats() {
    stats.value = await window.api.getStats()
  }

  return { stats, loadStats }
}
```

- [ ] **Step 2: 实现统计 Tab**

Rewrite `src/renderer/components/StatsTab.vue`:

```vue
<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useStats } from '../composables/useStats'

const { stats, loadStats } = useStats()

onMounted(loadStats)

// 柱状图：最近 30 天
const chartBars = computed(() => {
  if (!stats.value) return []
  const map = new Map(
    stats.value.dailyCounts.map(d => [d.date, d.count])
  )
  const bars: { date: string; count: number; label: string }[] = []

  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const count = map.get(dateStr) || 0
    bars.push({
      date: dateStr,
      count,
      label: `${d.getMonth() + 1}/${d.getDate()}`
    })
  }

  return bars
})

const maxCount = computed(() => {
  return Math.max(1, ...chartBars.value.map(b => b.count))
})
</script>

<template>
  <div class="stats-tab" v-if="stats">
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-number">{{ stats.total }}</div>
        <div class="stat-label">总词汇</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: var(--accent)">
          {{ stats.learning }}
        </div>
        <div class="stat-label">学习中</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: var(--success)">
          {{ stats.mastered }}
        </div>
        <div class="stat-label">已掌握</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.notStarted }}</div>
        <div class="stat-label">未学习</div>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-item">
        今日已复习：<strong>{{ stats.todayReviewed }}</strong>
      </div>
      <div class="stat-item">
        待复习：<strong>{{ stats.todayDue }}</strong>
      </div>
      <div class="stat-item">
        连续学习：<strong>{{ stats.streak }} 天</strong>
      </div>
    </div>

    <div class="chart-section">
      <h3>近 30 天复习量</h3>
      <div class="chart">
        <div
          v-for="bar in chartBars"
          :key="bar.date"
          class="chart-bar-wrapper"
          :title="`${bar.date}: ${bar.count} 次`"
        >
          <div
            class="chart-bar"
            :style="{
              height: (bar.count / maxCount) * 150 + 'px'
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-tab {
  padding: 30px 40px;
  overflow-y: auto;
  height: 100%;
}

.stat-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  flex: 1;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.stat-row {
  display: flex;
  gap: 24px;
  margin-bottom: 30px;
  color: var(--text-secondary);
  font-size: 14px;
}

.stat-row strong {
  color: var(--text-primary);
}

.chart-section h3 {
  margin-bottom: 16px;
  font-size: 16px;
  color: var(--text-secondary);
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 160px;
  padding: 5px 0;
}

.chart-bar-wrapper {
  flex: 1;
  display: flex;
  align-items: flex-end;
  height: 100%;
}

.chart-bar {
  width: 100%;
  min-height: 2px;
  background: var(--accent);
  border-radius: 2px 2px 0 0;
  transition: height 0.3s;
}
</style>
```

- [ ] **Step 3: 验证统计页面**

```bash
npm run dev
```

Expected: 统计页面显示数字卡片和柱状图。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/
git commit -m "feat: implement Stats tab with bar chart"
```

---

## Task 9: 配置与打包

**Files:**
- Modify: `electron.vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: 确保配置正确**

检查 `electron.vite.config.ts`，确保包含：

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [vue()]
  }
})
```

检查 `package.json` 的 `build` 字段包含：

```json
{
  "build": {
    "extraResources": [
      "resources/gptwords.json"
    ]
  }
}
```

- [ ] **Step 2: 验证开发环境和构建**

```bash
npm run dev       # 开发环境正常运行
npm run build     # 能成功构建
```

- [ ] **Step 3: Commit**

```bash
git add electron.vite.config.ts package.json
git commit -m "chore: configure electron-vite for production build"
```

---

## 验证清单（End-to-End）

完成所有 Task 后，按以下步骤验证：

- [ ] **启动**：`npm run dev`，窗口正常弹出，暗色主题，三个 Tab
- [ ] **浏览 Tab**：
  - 左侧列表显示 8000+ 词，滚动流畅
  - 搜索 "abandon" 能过滤出结果
  - 点击单词右侧显示完整 Markdown 内容
  - 点击"加入学习队列"，列表标记变为 ●
- [ ] **复习 Tab**：
  - 切换到复习 Tab，显示"没有待复习的单词"
  - 添加几个词后，手动修改 due_date 为今天：
    `sqlite3 ~/.word-learner/data.db "UPDATE words_progress SET due_date = date('now')"`
  - 回到复习 Tab，看到待复习数量
  - 空格揭示 → 内容完整显示 → 按 1/2/3/4 评分 → 自动下一个
  - 键盘操作顺畅
  - 全部完成后显示完成提示
- [ ] **统计 Tab**：
  - 数字卡片显示正确的数量
  - 柱状图有数据
  - 连续学习天数正确
- [ ] **SM-2 测试**：`npx vitest run` 所有测试通过
- [ ] **构建**：`npm run build` 成功
