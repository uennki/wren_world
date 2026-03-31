<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{
  words: string[]
  selectedWord: string | null
  queueChecker: (word: string) => boolean
}>()

const emit = defineEmits<{
  select: [word: string]
}>()

// 简单虚拟滚动
const ITEM_HEIGHT = 36
const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(500)

const visibleRange = computed(() => {
  const start = Math.floor(scrollTop.value / ITEM_HEIGHT)
  const count = Math.ceil(containerHeight.value / ITEM_HEIGHT) + 2
  return {
    start: Math.max(0, start - 1),
    end: Math.min(props.words.length, start + count)
  }
})

const visibleItems = computed(() => {
  return props.words.slice(visibleRange.value.start, visibleRange.value.end)
})

const totalHeight = computed(() => props.words.length * ITEM_HEIGHT)
const offsetY = computed(() => visibleRange.value.start * ITEM_HEIGHT)

function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLElement).scrollTop
}

onMounted(() => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
  }
})
</script>

<template>
  <div ref="containerRef" class="word-list" tabindex="0" @scroll="onScroll">
    <div :style="{ height: totalHeight + 'px', position: 'relative' }">
      <div :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="word in visibleItems"
          :key="word"
          class="word-item"
          :class="{
            selected: word === selectedWord,
            'in-queue': queueChecker(word)
          }"
          @click="emit('select', word)"
        >
          <span class="status-dot" :class="{ active: queueChecker(word) }"></span>
          <span class="word-text">{{ word }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.word-list {
  height: 100%;
  overflow-y: auto;
  outline: none;
}

.word-item {
  height: 34px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: pointer;
  font-size: 13px;
  gap: 8px;
  color: var(--text-secondary);
}

.word-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.word-item.selected {
  background: var(--accent-subtle);
  border-left: 2px solid var(--accent);
  color: var(--text-primary);
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
  transition: background 0.2s;
}

.status-dot.active {
  background: var(--accent);
}

.word-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
