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

// 今日单词：计划中的单词条目
export interface DailyPlanWord {
  plan_date: string
  word: string
  position: number
  viewed: number  // 0 | 1
}

// 今日单词：计划状态
export type DailyPlanStatusType = 'active' | 'completed_today' | 'all_learned'

export interface DailyPlanStatus {
  type: DailyPlanStatusType
  planDate?: string
  words?: DailyPlanWord[]
  total?: number
  viewedCount?: number
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
  // 今日单词
  getActiveDailyPlan: () => Promise<DailyPlanStatus>
  markWordViewed: (planDate: string, word: string) => Promise<void>
  completeDailyPlan: (planDate: string) => Promise<void>
  getDailyCount: () => Promise<number>
  setDailyCount: (count: number) => Promise<void>
  // 朗读
  speakWord: (word: string) => Promise<void>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
