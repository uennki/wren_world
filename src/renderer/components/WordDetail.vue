<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  word: string | null
  content: string | null
  inQueue: boolean
}>()

const emit = defineEmits<{
  'toggle-queue': []
}>()

const md = new MarkdownIt()

const renderedContent = computed(() => {
  if (!props.content) return ''
  return md.render(props.content)
})
</script>

<template>
  <div v-if="word" class="word-detail">
    <div class="detail-header">
      <h1>{{ word }}</h1>
      <button class="btn" :class="inQueue ? 'btn-outline' : 'btn-primary'" @click="emit('toggle-queue')">
        {{ inQueue ? '移出队列' : '+ 加入学习队列' }}
      </button>
    </div>
    <div class="detail-body">
      <div class="markdown-content" v-html="renderedContent" />
    </div>
  </div>
  <div v-else class="word-detail empty">
    <p>选择左侧单词查看详情</p>
  </div>
</template>

<style scoped>
.word-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.word-detail.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.detail-header h1 {
  font-size: 24px;
  font-weight: 600;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
</style>
