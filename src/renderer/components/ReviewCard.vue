<script setup lang="ts">
import SpeakButton from './SpeakButton.vue'

defineProps<{
  word: string
  revealed: boolean
  renderedContent: string
}>()

const emit = defineEmits<{
  reveal: []
}>()
</script>

<template>
  <div class="review-card">
    <div class="card-word">
      <div class="word-title">
        <h1>{{ word }}</h1>
        <SpeakButton :text="word" />
      </div>
    </div>

    <div v-if="!revealed" class="card-prompt">
      <p @click="emit('reveal')">点击揭示 / 按空格键</p>
    </div>

    <div v-else class="card-content">
      <div class="markdown-content" v-html="renderedContent" />
    </div>
  </div>
</template>

<style scoped>
.review-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-word {
  text-align: center;
  padding: 60px 40px 30px;
}

.card-word h1 {
  font-size: 44px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.word-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.card-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-prompt p {
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 12px 24px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  letter-spacing: 0.02em;
}

.card-prompt p:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-subtle);
}

.card-prompt p:active {
  transform: scale(0.97);
}

.card-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 48px 30px;
}
</style>
