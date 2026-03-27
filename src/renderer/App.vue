<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BrowseTab from './components/BrowseTab.vue'
import ReviewTab from './components/ReviewTab.vue'
import StatsTab from './components/StatsTab.vue'

const activeTab = ref<'browse' | 'review' | 'stats'>('browse')
const reviewCount = ref(0)

async function refreshReviewCount() {
  const list = await window.api.getTodayReviewList()
  reviewCount.value = list.length
}

onMounted(() => {
  refreshReviewCount()
})
</script>

<template>
  <div class="tab-nav">
    <button :class="{ active: activeTab === 'browse' }" @click="activeTab = 'browse'">浏览</button>
    <button
      :class="{ active: activeTab === 'review' }"
      @click="activeTab = 'review'; refreshReviewCount()"
    >
      今日复习 {{ reviewCount > 0 ? reviewCount : '' }}
    </button>
    <button :class="{ active: activeTab === 'stats' }" @click="activeTab = 'stats'">统计</button>
  </div>

  <div class="tab-content">
    <BrowseTab v-if="activeTab === 'browse'" @queue-changed="refreshReviewCount" />
    <ReviewTab v-if="activeTab === 'review'" @review-done="refreshReviewCount" />
    <StatsTab v-if="activeTab === 'stats'" />
  </div>
</template>
