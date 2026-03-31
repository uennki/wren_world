import { describe, it, expect, vi, afterEach } from 'vitest'
import { calculateSRS } from '../src/shared/srs'

// Mock 日期为固定值，方便测试（只 fake Date，不影响 setTimeout 等内部 timer）
function mockToday(dateStr: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(dateStr))
}

afterEach(() => {
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
