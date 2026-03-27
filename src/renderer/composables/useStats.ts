import { ref } from 'vue'
import type { StatsData } from '../../shared/types'

export function useStats() {
  const stats = ref<StatsData | null>(null)

  async function loadStats() {
    stats.value = await window.api.getStats()
  }

  return { stats, loadStats }
}
