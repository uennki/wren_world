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
  { rating: 1 as const, label: '忘了', colorKey: 'bad' },
  { rating: 2 as const, label: '模糊', colorKey: 'weak' },
  { rating: 3 as const, label: '认识', colorKey: 'ok' },
  { rating: 4 as const, label: '熟练', colorKey: 'good' }
]
</script>

<template>
  <div class="rating-buttons">
    <button
      v-for="btn in buttons"
      :key="btn.rating"
      class="rating-btn"
      :class="'rating-btn--' + btn.colorKey"
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
  gap: 16px;
  justify-content: center;
  padding: 24px 40px;
}

.rating-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 28px;
  background: transparent;
  border: 1px solid;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
  min-width: 100px;
}

.rating-btn:hover {
  filter: brightness(1.15);
  transform: translateY(-2px);
}

.rating-btn:active {
  transform: scale(0.97) translateY(0);
}

.rating-btn--bad {
  color: var(--rating-bad);
  border-color: var(--rating-bad-border);
  background: var(--rating-bad-bg);
}

.rating-btn--weak {
  color: var(--rating-weak);
  border-color: var(--rating-weak-border);
  background: var(--rating-weak-bg);
}

.rating-btn--ok {
  color: var(--rating-ok);
  border-color: var(--rating-ok-border);
  background: var(--rating-ok-bg);
}

.rating-btn--good {
  color: var(--rating-good);
  border-color: var(--rating-good-border);
  background: var(--rating-good-bg);
}

.rating-label {
  font-size: 15px;
  font-weight: 600;
}

.rating-interval {
  font-size: 11px;
  opacity: 0.7;
}
</style>
