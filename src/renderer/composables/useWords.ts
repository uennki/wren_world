import { ref, computed } from 'vue'

const allWords = ref<string[]>([])
const searchQuery = ref('')
const selectedWord = ref<string | null>(null)
const selectedContent = ref<string | null>(null)
const queueSet = ref<Set<string>>(new Set())
let loaded = false

export function useWords() {
  async function loadWords() {
    if (loaded) return
    allWords.value = await window.api.getWordList()
    const queueWords = await window.api.getQueueWords()
    queueSet.value = new Set(queueWords)
    loaded = true
  }

  const filteredWords = computed(() => {
    if (!searchQuery.value) return allWords.value
    const q = searchQuery.value.toLowerCase()
    return allWords.value.filter((w) => w.toLowerCase().includes(q))
  })

  async function selectWord(word: string) {
    selectedWord.value = word
    selectedContent.value = await window.api.getWordContent(word)
  }

  async function toggleQueue(word: string) {
    if (queueSet.value.has(word)) {
      await window.api.removeFromQueue(word)
      queueSet.value.delete(word)
    } else {
      await window.api.addToQueue(word)
      queueSet.value.add(word)
    }
  }

  function isInQueue(word: string): boolean {
    return queueSet.value.has(word)
  }

  return {
    allWords,
    searchQuery,
    selectedWord,
    selectedContent,
    filteredWords,
    loadWords,
    selectWord,
    toggleQueue,
    isInQueue
  }
}
