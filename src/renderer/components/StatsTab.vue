<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useStats } from '../composables/useStats'

const { stats, loadStats } = useStats()

onMounted(loadStats)

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 柱状图：最近 30 天
const chartBars = computed(() => {
  if (!stats.value) return []
  const map = new Map(stats.value.dailyCounts.map((d) => [d.date, d.count]))
  const bars: { date: string; count: number; label: string }[] = []

  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = formatLocalDate(d)
    const count = map.get(dateStr) || 0
    bars.push({
      date: dateStr,
      count,
      label: `${d.getMonth() + 1}/${d.getDate()}`
    })
  }

  return bars
})

const maxCount = computed(() => {
  return Math.max(1, ...chartBars.value.map((b) => b.count))
})
</script>

<template>
  <div v-if="stats" class="stats-tab">
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-number">{{ stats.total }}</div>
        <div class="stat-label">总词汇</div>
      </div>
      <div class="stat-card stat-card--accent">
        <div class="stat-number" style="color: var(--accent)">
          {{ stats.learning }}
        </div>
        <div class="stat-label">学习中</div>
      </div>
      <div class="stat-card stat-card--success">
        <div class="stat-number" style="color: var(--success)">
          {{ stats.mastered }}
        </div>
        <div class="stat-label">已掌握</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.notStarted }}</div>
        <div class="stat-label">未学习</div>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-item">
        今日已复习：<strong>{{ stats.todayReviewed }}</strong>
      </div>
      <div class="stat-item">
        待复习：<strong>{{ stats.todayDue }}</strong>
      </div>
      <div class="stat-item">
        连续学习：<strong>{{ stats.streak }} 天</strong>
      </div>
    </div>

    <div class="chart-section">
      <h3>近 30 天复习量</h3>
      <div class="chart">
        <div
          v-for="bar in chartBars"
          :key="bar.date"
          class="chart-bar-wrapper"
          :title="`${bar.date}: ${bar.count} 次`"
        >
          <div
            class="chart-bar"
            :style="{
              height: (bar.count / maxCount) * 150 + 'px'
            }"
          />
        </div>
      </div>
      <div class="chart-axis">
        <span>{{ chartBars[0]?.label }}</span>
        <span>{{ chartBars[14]?.label }}</span>
        <span>{{ chartBars[29]?.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-tab {
  padding: 30px 40px;
  overflow-y: auto;
  height: 100%;
}

.stat-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  flex: 1;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 20px;
  text-align: center;
}

.stat-card--accent {
  border-top: 2px solid var(--accent);
}

.stat-card--success {
  border-top: 2px solid var(--success);
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.stat-row {
  display: flex;
  gap: 24px;
  margin-bottom: 30px;
  color: var(--text-secondary);
  font-size: 13px;
}

.stat-row strong {
  color: var(--text-primary);
}

.chart-section h3 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 160px;
  padding: 5px 0;
}

.chart-bar-wrapper {
  flex: 1;
  display: flex;
  align-items: flex-end;
  height: 100%;
}

.chart-bar {
  width: 100%;
  min-height: 2px;
  background: var(--accent);
  opacity: 0.85;
  border-radius: 2px 2px 0 0;
  transition: height 0.3s;
}

.chart-axis {
  display: flex;
  justify-content: space-between;
  padding: 6px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
