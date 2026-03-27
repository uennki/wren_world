<script setup lang="ts">
import type { WordProgress } from '../../shared/types'

defineProps<{
  word: WordProgress
}>()

const emit = defineEmits<{
  rate: [rating: 1 | 2 | 3 | 4]
}>()

// 简单预估下次间隔（显示用）
function estimateInterval(current: WordProgress, rating: number): string {
  if (rating <= 2) return '1天'
  let interval: number
  if (current.repetitions === 0) interval = 1
  else if (current.repetitions === 1) interval = 3
  else interval = Math.round(current.interval * current.ease_factor)
  return interval >= 30 ? `${Math.round(interval / 30)}月` : `${interval}天`
}

const buttons = [
  { rating: 1 as const, label: '忘了', color: '#e94560' },
  { rating: 2 as const, label: '模糊', color: '#ffc857' },
  { rating: 3 as const, label: '认识', color: '#4ecca3' },
  { rating: 4 as const, label: '熟练', color: '#4ea8de' }
]
</script>

<template>
  <div class="rating-buttons">
    <button
      v-for="btn in buttons"
      :key="btn.rating"
      class="rating-btn"
      :style="{ borderColor: btn.color, color: btn.color }"
      @click="emit('rate', btn.rating)"
    >
      <span class="rating-label">{{ btn.label }}</span>
      <span class="rating-interval">
        {{ estimateInterval(word, btn.rating) }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.rating-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 20px;
}

.rating-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 24px;
  background: transparent;
  border: 2px solid;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}

.rating-btn:hover {
  background: rgb(255 255 255 / 5%);
  transform: translateY(-1px);
}

.rating-label {
  font-size: 16px;
  font-weight: 600;
}

.rating-interval {
  font-size: 12px;
  opacity: 0.7;
}
</style>
