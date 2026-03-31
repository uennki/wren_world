<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  text: string
  variant?: 'default' | 'soft-accent'
}>()

const isSpeaking = ref(false)
const variantClass = computed(() =>
  props.variant === 'soft-accent' ? 'variant-soft-accent' : 'variant-default'
)
const isSupported = computed(
  () => typeof window !== 'undefined' && typeof window.api?.speakWord === 'function'
)

async function speak(): Promise<void> {
  const value = props.text.trim()
  if (!value || !isSupported.value) return

  try {
    isSpeaking.value = true
    await window.api.speakWord(value)
  } catch (error) {
    console.error('Failed to speak word with local macOS voice:', error)
  } finally {
    isSpeaking.value = false
  }
}
</script>

<template>
  <button
    class="speak-btn"
    :class="[variantClass, { speaking: isSpeaking }]"
    type="button"
    :disabled="!isSupported"
    :title="isSupported ? '播放单词朗读（macOS 本地语音）' : '当前环境不支持本地语音朗读'"
    @click="speak"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  </button>
</template>

<style scoped>
.speak-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.speak-btn.variant-default:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-subtle);
}

.speak-btn.variant-default.speaking {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-subtle);
}

.speak-btn.variant-soft-accent {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 9999px;
  background: rgba(59, 130, 246, 0.16);
  color: #3b82f6;
}

.speak-btn.variant-soft-accent:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.22);
  color: #2563eb;
}

.speak-btn.variant-soft-accent.speaking {
  background: rgba(59, 130, 246, 0.28);
  color: #1d4ed8;
}

.speak-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.speak-btn:active:not(:disabled) {
  transform: scale(0.95);
}
</style>
