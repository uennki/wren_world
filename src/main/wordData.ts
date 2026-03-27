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
  const lines = rawData.split('\n').filter((line) => line.trim())
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
  return wordList.filter((w) => w.toLowerCase().includes(lower))
}

export function getTotalCount(): number {
  return wordList.length
}
