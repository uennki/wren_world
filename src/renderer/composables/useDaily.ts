import { ref, computed } from 'vue'
import type { DailyPlanWord, DailyPlanStatus } from '../../shared/types'

export function useDaily() {
  const status = ref<DailyPlanStatus | null>(null)
  const selectedWord = ref<string | null>(null)
  const selectedContent = ref<string | null>(null)
  const loading = ref(false)
  const checkingIn = ref(false)
  const showSettings = ref(false)
  const dailyCount = ref(20)

  const words = computed<DailyPlanWord[]>(() => status.value?.words ?? [])
  const total = computed(() => status.value?.total ?? 0)
  const viewedCount = computed(() => words.value.filter((w) => w.viewed === 1).length)
  const canCheckIn = computed(() => total.value > 0 && viewedCount.value >= total.value)
  const planDate = computed(() => status.value?.planDate ?? null)

  function isViewed(word: string): boolean {
    return words.value.some((w) => w.word === word && w.viewed === 1)
  }

  async function loadPlan() {
    loading.value = true
    try {
      status.value = await window.api.getActiveDailyPlan()
      dailyCount.value = await window.api.getDailyCount()
    } finally {
      loading.value = false
    }
  }

  async function selectWord(word: string) {
    selectedWord.value = word
    selectedContent.value = await window.api.getWordContent(word)

    // 点击即标记为已查看
    if (planDate.value && !isViewed(word)) {
      await window.api.markWordViewed(planDate.value, word)
      // 更新本地状态（避免重新拉取整个计划）
      const w = words.value.find((x) => x.word === word)
      if (w) w.viewed = 1
    }
  }

  async function checkIn() {
    if (!canCheckIn.value || !planDate.value || checkingIn.value) return
    checkingIn.value = true
    try {
      await window.api.completeDailyPlan(planDate.value)
      // 重新加载状态以展示完成界面
      status.value = await window.api.getActiveDailyPlan()
      selectedWord.value = null
      selectedContent.value = null
    } finally {
      checkingIn.value = false
    }
  }

  async function updateDailyCount(count: number) {
    await window.api.setDailyCount(count)
    dailyCount.value = count
    showSettings.value = false
  }

  return {
    status,
    words,
    total,
    viewedCount,
    canCheckIn,
    planDate,
    selectedWord,
    selectedContent,
    loading,
    checkingIn,
    showSettings,
    dailyCount,
    isViewed,
    loadPlan,
    selectWord,
    checkIn,
    updateDailyCount
  }
}
