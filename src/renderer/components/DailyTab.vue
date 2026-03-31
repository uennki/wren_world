<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useDaily } from '../composables/useDaily'
import WordDetail from './WordDetail.vue'

const {
  status,
  words,
  total,
  viewedCount,
  canCheckIn,
  selectedWord,
  selectedContent,
  loading,
  checkingIn,
  showSettings,
  dailyCount,
  isViewed,
  loadPlan,
  selectWord,
  checkIn,
  updateDailyCount
} = useDaily()

const settingsCount = ref(dailyCount.value)
watch(dailyCount, (v) => { settingsCount.value = v })

onMounted(loadPlan)
</script>

<template>
  <div class="daily-tab">
    <!-- 加载中 -->
    <div v-if="loading" class="daily-center-state">
      <p class="state-text">加载中…</p>
    </div>

    <!-- 全部词汇已学完 -->
    <div v-else-if="status?.type === 'all_learned'" class="daily-center-state">
      <div class="state-icon">🎉</div>
      <p class="state-title">全部词汇已加入学习计划</p>
      <p class="state-sub">去「今日复习」继续学习吧</p>
    </div>

    <!-- 今日已完成 -->
    <div v-else-if="status?.type === 'completed_today'" class="daily-center-state">
      <div class="state-icon">✓</div>
      <p class="state-title">今日已完成</p>
      <p class="state-sub">学了 {{ total }} 个新词，明日开始复习</p>
      <div class="completed-words">
        <span
          v-for="w in words"
          :key="w.word"
          class="completed-word-chip"
        >{{ w.word }}</span>
      </div>
    </div>

    <!-- 活跃计划 -->
    <template v-else-if="status?.type === 'active'">
      <div class="daily-layout">
        <!-- 左侧面板 -->
        <div class="left-panel">
          <!-- 标题 + 设置 -->
          <div class="panel-header">
            <span class="panel-title">今日单词</span>
            <button class="settings-btn" @click="showSettings = !showSettings" title="设置每日词数">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2m0 18v2m-7.07-2.93 1.41-1.41m10.32 0 1.41 1.41M1 12h2m18 0h2M4.93 4.93l1.41 1.41m10.32 0 1.41-1.41" />
              </svg>
            </button>
          </div>

          <!-- 设置面板 -->
          <div v-if="showSettings" class="settings-panel">
            <label class="settings-label">每日学习词数（1–50）</label>
            <div class="settings-row">
              <input
                v-model.number="settingsCount"
                type="number"
                min="1"
                max="50"
                class="settings-input"
              />
              <button class="btn btn-primary settings-save" @click="updateDailyCount(settingsCount)">保存</button>
            </div>
            <p class="settings-hint">下次生成新计划时生效</p>
          </div>

          <!-- 进度条 -->
          <div class="progress-bar-wrap">
            <div class="progress-bar">
              <div
                class="progress-bar-fill"
                :style="{ width: total > 0 ? (viewedCount / total * 100) + '%' : '0%' }"
              />
            </div>
            <span class="progress-text">{{ viewedCount }}/{{ total }}</span>
          </div>

          <!-- 词列表 -->
          <div class="word-list">
            <div
              v-for="w in words"
              :key="w.word"
              class="word-item"
              :class="{
                selected: w.word === selectedWord,
                viewed: isViewed(w.word)
              }"
              @click="selectWord(w.word)"
            >
              <span class="status-dot" :class="{ viewed: isViewed(w.word) }"></span>
              <span class="word-text">{{ w.word }}</span>
              <svg
                v-if="isViewed(w.word)"
                class="viewed-icon"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <!-- 打卡按钮 -->
          <div class="checkin-area">
            <button
              class="btn checkin-btn"
              :class="canCheckIn ? 'btn-success' : 'btn-disabled'"
              :disabled="!canCheckIn || checkingIn"
              @click="checkIn"
            >
              <template v-if="checkingIn">处理中…</template>
              <template v-else-if="canCheckIn">完成打卡 ✓</template>
              <template v-else>还差 {{ total - viewedCount }} 词</template>
            </button>
          </div>
        </div>

        <!-- 右侧：词详情 -->
        <div class="right-panel">
          <WordDetail
            :word="selectedWord"
            :content="selectedContent"
            :in-queue="false"
            :show-queue-button="false"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.daily-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ── 居中状态（空/完成） ── */
.daily-center-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  padding: 40px;
  text-align: center;
}

.state-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.state-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.state-sub {
  font-size: 13px;
  color: var(--text-secondary);
}

.completed-words {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 16px;
  max-width: 480px;
}

.completed-word-chip {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-secondary);
}

/* ── 主布局 ── */
.daily-layout {
  display: flex;
  height: 100%;
}

/* ── 左侧面板 ── */
.left-panel {
  width: 220px;
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.settings-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.settings-btn:hover {
  color: var(--text-secondary);
}

/* 设置面板 */
.settings-panel {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.settings-label {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 6px;
}

.settings-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.settings-input {
  width: 60px;
  padding: 4px 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.settings-input:focus {
  border-color: var(--accent);
}

.settings-save {
  padding: 4px 10px;
  font-size: 12px;
}

.settings-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 6px;
}

/* 进度条 */
.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s;
}

.progress-text {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* 词列表 */
.word-list {
  flex: 1;
  overflow-y: auto;
}

.word-item {
  height: 34px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: pointer;
  font-size: 13px;
  gap: 8px;
  color: var(--text-secondary);
  transition: background 0.1s;
}

.word-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.word-item.selected {
  background: var(--accent-subtle);
  border-left: 2px solid var(--accent);
  color: var(--text-primary);
}

.word-item.viewed {
  color: var(--text-muted);
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
  transition: background 0.2s;
}

.status-dot.viewed {
  background: var(--success);
}

.word-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewed-icon {
  color: var(--success);
  flex-shrink: 0;
}

/* 打卡区域 */
.checkin-area {
  padding: 10px 12px;
  border-top: 1px solid var(--border-subtle);
}

.checkin-btn {
  width: 100%;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-success {
  background: var(--success);
  color: #fff;
}

.btn-success:hover {
  filter: brightness(1.1);
}

.btn-disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: not-allowed;
}

/* ── 右侧 ── */
.right-panel {
  flex: 1;
  overflow: hidden;
}
</style>
