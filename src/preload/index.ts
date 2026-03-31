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
  submitReview: (word, rating) => ipcRenderer.invoke('submit-review', word, rating),
  getStats: () => ipcRenderer.invoke('get-stats'),
  getActiveDailyPlan: () => ipcRenderer.invoke('get-active-daily-plan'),
  markWordViewed: (planDate, word) => ipcRenderer.invoke('mark-word-viewed', planDate, word),
  completeDailyPlan: (planDate) => ipcRenderer.invoke('complete-daily-plan', planDate),
  getDailyCount: () => ipcRenderer.invoke('get-daily-count'),
  setDailyCount: (count) => ipcRenderer.invoke('set-daily-count', count),
  speakWord: (word) => ipcRenderer.invoke('speak-word', word)
}

contextBridge.exposeInMainWorld('api', api)
