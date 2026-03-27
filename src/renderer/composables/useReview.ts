import { ref, computed } from 'vue'
import MarkdownIt from 'markdown-it'
import type { WordProgress } from '../../shared/types'

const md = new MarkdownIt()

export function useReview() {
  const reviewList = ref<WordProgress[]>([])
  const currentIndex = ref(0)
  const revealed = ref(false)
  const currentContent = ref<string | null>(null)
  const sessionDone = ref(0)
  const finished = ref(false)

  const currentWord = computed(() => {
    if (currentIndex.value >= reviewList.value.length) return null
    return reviewList.value[currentIndex.value]
  })

  const renderedContent = computed(() => {
    if (!currentContent.value) return ''
    return md.render(currentContent.value)
  })

  const totalCount = computed(() => reviewList.value.length)
  const remaining = computed(() => Math.max(0, totalCount.value - currentIndex.value))

  async function loadReviewList() {
    reviewList.value = await window.api.getTodayReviewList()
    currentIndex.value = 0
    revealed.value = false
    finished.value = reviewList.value.length === 0
    sessionDone.value = 0

    if (reviewList.value.length > 0) {
      await loadCurrentContent()
    }
  }

  async function loadCurrentContent() {
    if (!currentWord.value) return
    currentContent.value = await window.api.getWordContent(currentWord.value.word)
  }

  function reveal() {
    if (!currentWord.value || revealed.value) return
    revealed.value = true
  }

  async function rate(rating: 1 | 2 | 3 | 4) {
    if (!currentWord.value || !revealed.value) return

    await window.api.submitReview(currentWord.value.word, rating)
    sessionDone.value++

    // 移动到下一个
    currentIndex.value++
    revealed.value = false
    currentContent.value = null

    if (currentIndex.value >= reviewList.value.length) {
      finished.value = true
    } else {
      await loadCurrentContent()
    }
  }

  return {
    currentWord,
    revealed,
    renderedContent,
    totalCount,
    remaining,
    sessionDone,
    finished,
    loadReviewList,
    reveal,
    rate
  }
}
