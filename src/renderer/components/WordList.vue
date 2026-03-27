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
          <span class="dot">{{ queueChecker(word) ? '●' : '○' }}</span>
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
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: pointer;
  font-size: 14px;
  gap: 8px;
}

.word-item:hover {
  background: var(--bg-card);
}

.word-item.selected {
  background: var(--bg-card);
  border-left: 2px solid var(--accent);
}

.dot {
  font-size: 10px;
  color: var(--text-secondary);
}

.word-item.in-queue .dot {
  color: var(--accent);
}

.word-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
