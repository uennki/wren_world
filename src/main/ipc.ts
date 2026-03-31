import { ipcMain } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import * as wordData from './wordData'
import * as database from './database'

const MAX_WORD_LENGTH = 128
const MAX_QUERY_LENGTH = 256
const MACOS_VOICE = 'Samantha'

let activeSayProcess: ChildProcessWithoutNullStreams | null = null

function assertWord(word: unknown): string {
  if (typeof word !== 'string') {
    throw new Error('Invalid word: must be a string')
  }
  const normalized = word.trim()
  if (!normalized || normalized.length > MAX_WORD_LENGTH) {
    throw new Error('Invalid word: empty or too long')
  }
  return normalized
}

function assertQuery(query: unknown): string {
  if (typeof query !== 'string') {
    throw new Error('Invalid query: must be a string')
  }
  const normalized = query.trim()
  if (normalized.length > MAX_QUERY_LENGTH) {
    throw new Error('Invalid query: too long')
  }
  return normalized
}

function assertRating(rating: unknown): 1 | 2 | 3 | 4 {
  if (rating === 1 || rating === 2 || rating === 3 || rating === 4) {
    return rating
  }
  throw new Error('Invalid rating: must be 1-4')
}

function stopActiveSpeech(): void {
  if (activeSayProcess && !activeSayProcess.killed) {
    activeSayProcess.kill()
  }
  activeSayProcess = null
}

function speakWordOnMacOS(word: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      reject(new Error('Local speech is only supported on macOS'))
      return
    }

    stopActiveSpeech()
    const sayProcess = spawn('say', ['-v', MACOS_VOICE, word])
    activeSayProcess = sayProcess

    sayProcess.once('error', (error) => {
      if (activeSayProcess === sayProcess) activeSayProcess = null
      reject(error)
    })

    sayProcess.once('close', (code, signal) => {
      if (activeSayProcess === sayProcess) activeSayProcess = null

      if (signal === 'SIGTERM') {
        resolve()
        return
      }

      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`macOS say failed with exit code ${String(code)}`))
    })
  })
}

export function registerIPC(): void {
  // 单词数据
  ipcMain.handle('get-word-list', () => wordData.getWordList())
  ipcMain.handle('get-word-content', (_, word: unknown) => wordData.getWordContent(assertWord(word)))
  ipcMain.handle('search-words', (_, query: unknown) => wordData.searchWords(assertQuery(query)))

  // 学习队列
  ipcMain.handle('add-to-queue', (_, word: unknown) => database.addToQueue(assertWord(word)))
  ipcMain.handle('remove-from-queue', (_, word: unknown) =>
    database.removeFromQueue(assertWord(word))
  )
  ipcMain.handle('is-in-queue', (_, word: unknown) => database.isInQueue(assertWord(word)))
  ipcMain.handle('get-queue-words', () => database.getQueueWords())

  // 复习
  ipcMain.handle('get-today-review-list', () => database.getTodayReviewList())
  ipcMain.handle('submit-review', (_, word: unknown, rating: unknown) =>
    database.submitReview(assertWord(word), assertRating(rating))
  )

  // 统计
  ipcMain.handle('get-stats', () => database.getStats(wordData.getTotalCount()))

  // 今日单词
  ipcMain.handle('get-active-daily-plan', () =>
    database.getActiveDailyPlan(wordData.getWordList())
  )
  ipcMain.handle('mark-word-viewed', (_, planDate: unknown, word: unknown) =>
    database.markWordViewed(assertWord(planDate as string), assertWord(word))
  )
  ipcMain.handle('complete-daily-plan', (_, planDate: unknown) =>
    database.completeDailyPlan(assertWord(planDate as string))
  )
  ipcMain.handle('get-daily-count', () => database.getDailyCount())
  ipcMain.handle('set-daily-count', (_, count: unknown) => {
    const n = Number(count)
    if (!Number.isInteger(n)) throw new Error('Invalid count')
    database.setDailyCount(n)
  })

  // 朗读（macOS 本地 say）
  ipcMain.handle('speak-word', (_, word: unknown) => speakWordOnMacOS(assertWord(word)))
}
