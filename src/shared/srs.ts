import type { SRSInput, SRSOutput } from './types'

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const status = newRepetitions >= 6 && newInterval >= 21 ? 'mastered' : 'learning'

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
