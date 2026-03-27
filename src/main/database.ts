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
    INSERT INTO review_log (word, rating, reviewed_at)
    VALUES (?, ?, ?)
  `).run(word, rating, now)
}

export function getStats(totalWords: number): StatsData {
  const today = getToday()

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
    db.prepare('SELECT COUNT(*) as c FROM review_log WHERE date(reviewed_at) = ?').get(today) as {
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
