<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BrowseTab from './components/BrowseTab.vue'
import DailyTab from './components/DailyTab.vue'
import ReviewTab from './components/ReviewTab.vue'
import StatsTab from './components/StatsTab.vue'
import { useTheme } from "./composables/useTheme"

const activeTab = ref<'browse' | 'daily' | 'review' | 'stats'>('browse')
const reviewCount = ref(0)
const { theme, toggle } = useTheme()

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
    <button :class="{ active: activeTab === 'daily' }" @click="activeTab = 'daily'">今日单词</button>
    <button
      :class="{ active: activeTab === 'review' }"
      @click="activeTab = 'review'; refreshReviewCount()"
    >
      今日复习
      <span v-if="reviewCount > 0" class="tab-badge">{{ reviewCount }}</span>
    </button>
    <button :class="{ active: activeTab === 'stats' }" @click="activeTab = 'stats'">统计</button>
    <button class="theme-toggle" @click="toggle">{{ theme === "dark" ? "☀️" : "🌙" }}</button>
  </div>

  <div class="tab-content">
    <BrowseTab v-if="activeTab === 'browse'" @queue-changed="refreshReviewCount" />
    <DailyTab v-if="activeTab === 'daily'" />
    <ReviewTab v-if="activeTab === 'review'" @review-done="refreshReviewCount" />
    <StatsTab v-if="activeTab === 'stats'" />
  </div>
</template>

<style scoped>
.theme-toggle {
  margin-left: auto;
  padding: 0 12px;
  font-size: 16px;
  -webkit-app-region: no-drag;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.theme-toggle:hover {
  opacity: 1;
}
</style>
