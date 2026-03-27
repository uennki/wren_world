import { ipcMain } from 'electron'
import * as wordData from './wordData'
import * as database from './database'

export function registerIPC(): void {
  // 单词数据
  ipcMain.handle('get-word-list', () => wordData.getWordList())
  ipcMain.handle('get-word-content', (_, word: string) => wordData.getWordContent(word))
  ipcMain.handle('search-words', (_, query: string) => wordData.searchWords(query))

  // 学习队列
  ipcMain.handle('add-to-queue', (_, word: string) => database.addToQueue(word))
  ipcMain.handle('remove-from-queue', (_, word: string) => database.removeFromQueue(word))
  ipcMain.handle('is-in-queue', (_, word: string) => database.isInQueue(word))
  ipcMain.handle('get-queue-words', () => database.getQueueWords())

  // 复习
  ipcMain.handle('get-today-review-list', () => database.getTodayReviewList())
  ipcMain.handle('submit-review', (_, word: string, rating: 1 | 2 | 3 | 4) =>
    database.submitReview(word, rating)
  )

  // 统计
  ipcMain.handle('get-stats', () => database.getStats(wordData.getTotalCount()))
}
