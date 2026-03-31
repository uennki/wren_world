<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useWords } from '../composables/useWords'
import WordList from './WordList.vue'
import WordDetail from './WordDetail.vue'

const emit = defineEmits<{ 'queue-changed': [] }>()

const {
  searchQuery,
  selectedWord,
  selectedContent,
  filteredWords,
  loadWords,
  selectWord,
  toggleQueue,
  isInQueue
} = useWords()

const searchInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await loadWords()
  // Cmd+F 快捷键
  window.addEventListener('keydown', (e) => {
    if (e.metaKey && e.key === 'f') {
      e.preventDefault()
      searchInput.value?.focus()
    }
  })
})

async function handleToggleQueue() {
  if (selectedWord.value) {
    await toggleQueue(selectedWord.value)
    emit('queue-changed')
  }
}
</script>

<template>
  <div class="browse-tab">
    <div class="left-panel">
      <div class="search-box">
        <div class="search-wrapper">
          <svg
            class="search-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="搜索单词..."
            class="search-input"
          />
        </div>
      </div>
      <WordList
        :words="filteredWords"
        :selected-word="selectedWord"
        :queue-checker="isInQueue"
        @select="selectWord"
      />
    </div>
    <div class="right-panel">
      <WordDetail
        :word="selectedWord"
        :content="selectedContent"
        :in-queue="selectedWord ? isInQueue(selectedWord) : false"
        @toggle-queue="handleToggleQueue"
      />
    </div>
  </div>
</template>

<style scoped>
.browse-tab {
  display: flex;
  height: 100%;
}

.left-panel {
  width: 220px;
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
}

.search-box {
  padding: 10px;
  border-bottom: 1px solid var(--border);
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-secondary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 7px 10px 7px 30px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.right-panel {
  flex: 1;
}
</style>
