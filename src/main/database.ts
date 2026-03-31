import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { calculateSRS, getToday, getTomorrow } from '../shared/srs'
import type { WordProgress, StatsData, DailyPlanWord, DailyPlanStatus } from '../shared/types'

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
      reviewed_at TEXT,
      reviewed_date TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_due_date
    ON words_progress(due_date);

    CREATE INDEX IF NOT EXISTS idx_words_status
    ON words_progress(status);

    CREATE INDEX IF NOT EXISTS idx_words_status_due_date
    ON words_progress(status, due_date);

    CREATE INDEX IF NOT EXISTS idx_reviewed_at
    ON review_log(reviewed_at);

    CREATE TABLE IF NOT EXISTS daily_plan (
      plan_date TEXT NOT NULL,
      word      TEXT NOT NULL,
      position  INTEGER NOT NULL,
      viewed    INTEGER DEFAULT 0,
      UNIQUE(plan_date, word)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_plan_date
    ON daily_plan(plan_date);

    CREATE TABLE IF NOT EXISTS daily_plan_meta (
      plan_date   TEXT PRIMARY KEY,
      total_count INTEGER NOT NULL,
      completed   INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // 兼容旧版本数据库：补 reviewed_date 列并回填
  const reviewLogColumns = db.prepare('PRAGMA table_info(review_log)').all() as {
    name: string
  }[]
  const hasReviewedDate = reviewLogColumns.some((column) => column.name === 'reviewed_date')

  if (!hasReviewedDate) {
    db.prepare('ALTER TABLE review_log ADD COLUMN reviewed_date TEXT').run()
  }

  db.prepare('CREATE INDEX IF NOT EXISTS idx_reviewed_date ON review_log(reviewed_date)').run()

  db.prepare(`
    UPDATE review_log
    SET reviewed_date = date(reviewed_at, 'localtime')
    WHERE reviewed_date IS NULL AND reviewed_at IS NOT NULL
  `).run()
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
  const rows = db.prepare('SELECT word FROM words_progress ORDER BY created_at').all() as {
    word: string
  }[]
  return rows.map((r) => r.word)
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
  const reviewedDate = getToday()

  // 查询当前状态
  const current = db
    .prepare('SELECT * FROM words_progress WHERE word = ?')
    .get(word) as WordProgress | undefined

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
    result.status,
    result.ease_factor,
    result.interval,
    result.repetitions,
    result.due_date,
    now,
    word
  )

  // 写入复习日志
  db.prepare(`
    INSERT INTO review_log (word, rating, reviewed_at, reviewed_date)
    VALUES (?, ?, ?, ?)
  `).run(word, rating, now, reviewedDate)
}

export function getStats(totalWords: number): StatsData {
  const today = getToday()
  const startDate = getDateDaysAgo(29)

  const learning = (
    db.prepare("SELECT COUNT(*) as c FROM words_progress WHERE status = 'learning'").get() as {
      c: number
    }
  ).c

  const mastered = (
    db.prepare("SELECT COUNT(*) as c FROM words_progress WHERE status = 'mastered'").get() as {
      c: number
    }
  ).c

  const todayReviewed = (
    db.prepare('SELECT COUNT(*) as c FROM review_log WHERE reviewed_date = ?').get(today) as {
      c: number
    }
  ).c

  const todayDue = (
    db.prepare('SELECT COUNT(*) as c FROM words_progress WHERE due_date <= ?').get(today) as {
      c: number
    }
  ).c

  // 近 30 天每日复习量
  const dailyCounts = db.prepare(`
    SELECT reviewed_date as date, COUNT(*) as count
    FROM review_log
    WHERE reviewed_date >= ?
    GROUP BY reviewed_date
    ORDER BY date ASC
  `).all(startDate) as { date: string; count: number }[]

  // 连续学习天数
  const streak = calculateStreak()

  return {
    total: totalWords,
    learning,
    mastered,
    notStarted: Math.max(0, totalWords - learning - mastered),
    todayReviewed,
    todayDue,
    streak,
    dailyCounts
  }
}

function calculateStreak(): number {
  const dates = db.prepare(`
    SELECT DISTINCT reviewed_date as d
    FROM review_log
    WHERE reviewed_date IS NOT NULL
    ORDER BY d DESC
  `).all() as { d: string }[]

  if (dates.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < dates.length; i++) {
    const expectedStr = getDateDaysAgo(i, today)

    if (dates[i].d === expectedStr) {
      streak++
    } else {
      break
    }
  }

  return streak
}

// ─── 今日单词功能 ────────────────────────────────────────────────────────────

/**
 * 确定性 seeded shuffle，相同 seed + 相同数组 → 相同顺序
 * 使用简单多项式 hash，轻量且足够分散
 */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const hash = (s: string): number => {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(31, h) + s.charCodeAt(i) | 0
    }
    return h
  }
  return [...arr].sort((a, b) => hash(String(a) + seed) - hash(String(b) + seed))
}

export function getDailyCount(): number {
  const row = db.prepare('SELECT value FROM user_settings WHERE key = ?').get('daily_word_count') as
    | { value: string }
    | undefined
  return row ? parseInt(row.value, 10) : 20
}

export function setDailyCount(count: number): void {
  if (count < 1 || count > 50) {
    throw new Error('daily_word_count must be between 1 and 50')
  }
  db.prepare('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)').run(
    'daily_word_count',
    String(count)
  )
}

/**
 * 获取当前活跃的今日单词计划（或生成新计划）
 * 优先级：最近未完成计划 → 今日已完成 → 生成新计划
 */
export function getActiveDailyPlan(allWords: string[]): DailyPlanStatus {
  // 1. 查找最近未完成的计划
  const activeMeta = db.prepare(
    'SELECT * FROM daily_plan_meta WHERE completed = 0 ORDER BY plan_date DESC LIMIT 1'
  ).get() as { plan_date: string; total_count: number; completed: number } | undefined

  if (activeMeta) {
    const words = db.prepare(
      'SELECT * FROM daily_plan WHERE plan_date = ? ORDER BY position'
    ).all(activeMeta.plan_date) as DailyPlanWord[]
    const viewedCount = words.filter((w) => w.viewed === 1).length
    return {
      type: 'active',
      planDate: activeMeta.plan_date,
      words,
      total: activeMeta.total_count,
      viewedCount
    }
  }

  // 2. 检查今日是否已完成
  const today = getToday()
  const completedToday = db.prepare(
    'SELECT 1 FROM daily_plan_meta WHERE plan_date = ? AND completed = 1'
  ).get(today)
  if (completedToday) {
    const words = db.prepare(
      'SELECT * FROM daily_plan WHERE plan_date = ? ORDER BY position'
    ).all(today) as DailyPlanWord[]
    return { type: 'completed_today', planDate: today, words, total: words.length, viewedCount: words.length }
  }

  // 3. 生成今日新计划
  const inQueue = new Set(
    (db.prepare('SELECT word FROM words_progress').all() as { word: string }[]).map((r) => r.word)
  )
  const available = allWords.filter((w) => !inQueue.has(w))

  if (available.length === 0) {
    return { type: 'all_learned' }
  }

  const count = Math.min(getDailyCount(), available.length)
  const selected = seededShuffle(available, today).slice(0, count)

  const insertMeta = db.prepare(
    'INSERT OR IGNORE INTO daily_plan_meta (plan_date, total_count, completed) VALUES (?, ?, 0)'
  )
  const insertWord = db.prepare(
    'INSERT OR IGNORE INTO daily_plan (plan_date, word, position, viewed) VALUES (?, ?, ?, 0)'
  )

  const doGenerate = db.transaction(() => {
    insertMeta.run(today, count)
    selected.forEach((word, idx) => insertWord.run(today, word, idx + 1))
  })
  doGenerate()

  const words = db.prepare(
    'SELECT * FROM daily_plan WHERE plan_date = ? ORDER BY position'
  ).all(today) as DailyPlanWord[]

  return { type: 'active', planDate: today, words, total: count, viewedCount: 0 }
}

export function markWordViewed(planDate: string, word: string): void {
  db.prepare('UPDATE daily_plan SET viewed = 1 WHERE plan_date = ? AND word = ?').run(planDate, word)
}

/**
 * 完成打卡：标记计划完成，并将所有词批量加入 words_progress
 * 使用事务保证原子性
 */
export function completeDailyPlan(planDate: string): void {
  const words = db.prepare(
    'SELECT word FROM daily_plan WHERE plan_date = ?'
  ).all(planDate) as { word: string }[]

  const now = new Date().toISOString()
  const tomorrow = getTomorrow()

  const insertWord = db.prepare(`
    INSERT OR IGNORE INTO words_progress
    (word, status, ease_factor, interval, repetitions, due_date, created_at, updated_at)
    VALUES (?, 'learning', 2.5, 0, 0, ?, ?, ?)
  `)

  const doComplete = db.transaction(() => {
    db.prepare('UPDATE daily_plan_meta SET completed = 1 WHERE plan_date = ?').run(planDate)
    for (const { word } of words) {
      insertWord.run(word, tomorrow, now, now)
    }
  })
  doComplete()
}

// ─── 内部工具 ─────────────────────────────────────────────────────────────────

function getDateDaysAgo(daysAgo: number, fromDate: Date = new Date()): string {
  const date = new Date(fromDate)
  date.setDate(date.getDate() - daysAgo)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
