<script setup lang="ts">
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
      <h1>{{ word }}</h1>
    </div>

    <div v-if="!revealed" class="card-prompt" @click="emit('reveal')">
      <p>点击揭示 / 按空格键</p>
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
  padding: 40px 20px 20px;
}

.card-word h1 {
  font-size: 36px;
  font-weight: 700;
}

.card-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 16px;
}

.card-prompt:hover {
  color: var(--text-primary);
}

.card-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 40px 20px;
}
</style>
