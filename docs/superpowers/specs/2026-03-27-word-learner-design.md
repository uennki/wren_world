# GPT4 单词学习 App — 设计规格

## 概述

基于 [DictionaryByGPT4](https://github.com/Ceelog/DictionaryByGPT4) 仓库的 8000 词 GPT-4 生成词典数据，构建一个 macOS 桌面端单词学习应用。核心采用间隔重复（SRS）记忆模式，参考墨墨背单词。

## 技术栈

- **electron-vite** — Electron + Vite 脚手架
- **Vue 3 + Composition API** — 前端框架
- **better-sqlite3** — 本地 SQLite 存储学习进度和 SRS 调度
- **gptwords.json** — 打包进应用，启动时全量加载到内存（约 17MB，可接受）
- **markdown-it** — 渲染单词内容中的 Markdown

## 数据架构

```
gptwords.json（只读，17MB）    SQLite（读写）
  word: 单词名                  words_progress: 学习状态 + SRS 数据
  content: Markdown 内容         review_log: 复习日志（统计用）
         ↓                            ↓
               合并后展示给用户
```

### gptwords.json 单条结构

```json
{
  "word": "abandon",
  "content": "### 分析词义\n...\n### 列举例句\n...\n### 词根分析\n...\n### 发展历史和文化背景\n...\n### 单词变形\n...\n### 记忆辅助\n...\n### 小故事\n..."
}
```

### 数据加载策略

启动时一次性解析 `gptwords.json`，构建两个内存结构：
- `wordList: string[]` — 按字母排序的单词名列表（用于列表和搜索）
- `wordMap: Map<string, string>` — word → content 的映射（用于内容展示）

17MB JSON 在 Electron 主进程解析约 200-300ms，无需 loading 画面。

### SQLite 表结构

```sql
-- 学习记录
CREATE TABLE IF NOT EXISTS words_progress (
  word        TEXT PRIMARY KEY,
  status      TEXT DEFAULT 'learning',  -- learning | mastered
  ease_factor REAL DEFAULT 2.5,
  interval    INTEGER DEFAULT 0,        -- 复习间隔（天）
  repetitions INTEGER DEFAULT 0,        -- 连续正确次数
  due_date    TEXT,                      -- 下次复习日期 YYYY-MM-DD
  created_at  TEXT,
  updated_at  TEXT
);

-- 复习日志
CREATE TABLE IF NOT EXISTS review_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word        TEXT,
  rating      INTEGER,  -- 1=忘了 2=模糊 3=认识 4=熟练
  reviewed_at TEXT
);

-- due_date 索引（加速复习队列查询）
CREATE INDEX IF NOT EXISTS idx_due_date ON words_progress(due_date);
```

### 初始化

应用首次启动时，`CREATE TABLE IF NOT EXISTS` 自动建表。如果 SQLite 文件损坏，删除后重建（学习进度丢失，可接受因为是个人工具）。

SQLite 文件路径：`~/.word-learner/data.db`，用户可手动备份此文件。

## 页面设计

### 三 Tab 导航

`[ 浏览 ]  [ 今日复习 N ]  [ 统计 ]`

Tab 上的"今日复习"动态显示待复习数量。

**默认窗口**：1000x700px，最小尺寸 800x500px。

---

### Tab 1 — 浏览

**布局**：左右两栏（左 250px 固定，右侧自适应）

- **左栏**：搜索框 + 单词列表（虚拟滚动，8000 词不卡顿）
  - 搜索：仅匹配英文单词名（实时过滤，不搜索内容）
  - 列表项标记状态：● 已加入队列 / ○ 未学习
- **右栏**：选中单词的完整 Markdown 内容（7 个板块全部展示）
  - 底部按钮：「加入学习队列」/「移出队列」

**"加入学习队列"操作**：
- 在 `words_progress` 插入一行：`status='learning', due_date=明天, interval=0, ease_factor=2.5`
- `due_date` 设为**明天**，不是当天（避免刚加的词立刻出现在复习队列）

**"移出队列"操作**：
- 从 `words_progress` 删除该行
- `review_log` 中的历史记录保留（统计用）
- `mastered` 状态的词也可以移出

**交互**：
- 点击左栏单词 → 右栏显示内容
- 键盘 ↑↓ 切换上下词
- ⌘F 聚焦搜索框

---

### Tab 2 — 今日复习

**复习队列查询**：

```sql
SELECT word FROM words_progress
WHERE due_date <= date('now') AND status = 'learning'
ORDER BY due_date ASC, ease_factor ASC
```

优先复习：逾期最久的词 → 难度最高（ease_factor 最低）的词。

**复习流程状态机**：

```
┌──────────┐   空格键    ┌──────────┐  1/2/3/4  ┌──────────┐
│ 显示单词  │ ────────→  │ 揭示内容  │ ────────→ │ 自动下一个 │
│（等待揭示）│           │（等待评分）│          │（回到显示） │
└──────────┘            └──────────┘           └──────────┘
                                                    │
                                              队列清空？
                                              ├── 否 → 回到"显示单词"
                                              └── 是 → 显示"复习完成"
```

- **空格键只做一件事**：揭示内容。评分后自动切换到下一个词。
- **评分 1（忘了）的词**：不在本次 session 内重新排队，明天再次出现。

**揭示前**：居中大字显示单词

**揭示后**：展示全部 7 个板块内容 + 底部 4 个评分按钮

**评分按钮**（每个按钮下方显示预计间隔）：

| 按钮 | 含义 | 下次间隔示例 |
|------|------|-------------|
| 忘了 | 完全不记得 | 1 天 |
| 模糊 | 有印象但不确定 | 1 天 |
| 认识 | 想起来了 | 按 SM-2 计算 |
| 熟练 | 秒出答案 | 按 SM-2 加速 |

**边界状态**：
- 队列为空（从未加过词）：显示"没有待复习的单词，去浏览页添加吧"
- 今日全部完成：显示"今日复习完成 🎉"
- 长期未打开导致大量逾期：全部显示，不设上限（个人工具，自己把控节奏）

**键盘快捷键**：空格=揭示，1/2/3/4=评分

---

### Tab 3 — 统计

- 总词汇（8000）/ 学习中 / 已掌握 / 未学习（数字卡片）
- 近 30 天每日复习量（柱状图，从 `review_log` 按日期聚合）
- 今日已复习 / 待复习
- 连续学习天数（定义：`review_log` 中有记录的连续日期天数，0 条复习不算）

---

## SRS 算法（SM-2）

### 评分处理

```
评分 1（忘了）：
  interval = 1
  repetitions = 0
  ease_factor -= 0.2（最低 1.3）

评分 2（模糊）：
  interval = 1
  repetitions = 0
  ease_factor -= 0.15（最低 1.3）

评分 3（认识）：
  if repetitions == 0: interval = 1
  elif repetitions == 1: interval = 3
  else: interval = round(interval * ease_factor)
  repetitions += 1
  （ease_factor 不变 — 这是有意简化）

评分 4（熟练）：
  同评分 3 的 interval 计算
  ease_factor += 0.15
  repetitions += 1
```

### due_date 计算

```
due_date = 今天日期 + interval 天
```

始终基于"今天"计算，不基于旧的 due_date（即使逾期复习也从今天算起）。

### 状态流转

```
未学习 ──(加入队列)──→ learning ──(repetitions>=6 且 interval>=21)──→ mastered
                          ↑                                           │
                          └────────(评分1或2，重置 repetitions)────────┘
```

- **mastered 的词仍然有 due_date**，到期仍出现在复习队列
- 如果 mastered 的词被评为 1（忘了）或 2（模糊），降级回 `learning`
- mastered 阈值：`repetitions >= 6 且 interval >= 21 天`

## 键盘快捷键汇总

| 按键 | 功能 | 适用 Tab |
|------|------|---------|
| 空格 | 揭示内容 | 复习 |
| 1/2/3/4 | 评分 | 复习 |
| ↑ ↓ | 切换上下词 | 浏览 |
| ⌘F | 聚焦搜索 | 浏览 |

## 不做的事

- 不做复习提醒/通知
- 不做多设备同步
- 不做在线功能
- 不做测验/选择题模式
- 不做单词书分类（全部 8000 词统一列表）
- 不做中文全文搜索（仅搜索英文单词名）
- 不做每日新词/复习上限
