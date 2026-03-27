<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useReview } from '../composables/useReview'
import ReviewCard from './ReviewCard.vue'
import RatingButtons from './RatingButtons.vue'
import EmptyState from './EmptyState.vue'

const emit = defineEmits<{ 'review-done': [] }>()

const {
  currentWord,
  revealed,
  renderedContent,
  totalCount,
  remaining,
  sessionDone,
  finished,
  loadReviewList,
  reveal,
  rate
} = useReview()

async function handleRate(rating: 1 | 2 | 3 | 4) {
  await rate(rating)
  emit('review-done')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === ' ' && !revealed.value && currentWord.value) {
    e.preventDefault()
    reveal()
  } else if (revealed.value && ['1', '2', '3', '4'].includes(e.key)) {
    e.preventDefault()
    handleRate(Number(e.key) as 1 | 2 | 3 | 4)
  }
}

onMounted(async () => {
  await loadReviewList()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="review-tab">
    <!-- 无待复习 -->
    <EmptyState v-if="totalCount === 0 && !finished" message="没有待复习的单词，去浏览页添加吧" />

    <!-- 复习完成 -->
    <EmptyState v-else-if="finished && sessionDone > 0" message="今日复习完成" />

    <!-- 复习进行中 -->
    <template v-else-if="currentWord">
      <div class="review-header">
        <span>待复习：{{ remaining }}</span>
        <span>已完成：{{ sessionDone }}</span>
      </div>

      <ReviewCard
        :word="currentWord.word"
        :revealed="revealed"
        :rendered-content="renderedContent"
        @reveal="reveal"
      />

      <RatingButtons v-if="revealed" :word="currentWord" @rate="handleRate" />
    </template>
  </div>
</template>

<style scoped>
.review-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.review-header {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 12px;
  color: var(--text-secondary);
  font-size: 14px;
  border-bottom: 1px solid var(--border);
}
</style>
