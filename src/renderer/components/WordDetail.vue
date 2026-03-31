<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import SpeakButton from './SpeakButton.vue'

const props = defineProps<{
  word: string | null
  content: string | null
  inQueue: boolean
  showQueueButton?: boolean
}>()

const emit = defineEmits<{
  'toggle-queue': []
}>()

const md = new MarkdownIt({ html: true })

// 统一 AI 生成内容的标题格式，处理所有变体：
//   **1\. 分析词义**[spaces] → ## 分析词义   (转义dot + 末尾空格)
//   **分析词义**[spaces]     → ## 分析词义   (无序号)
//   ## 1. 分析词义           → ## 分析词义   (heading格式)
// CSS counter 统一补回序号
function normalizeHeadings(content: string): string {
  return content
    .replace(/^\*\*(?:\d+\\?\.\s*)?([^*\n\r]+?)\s*\*\*\s*$/gm, '## $1')
    .replace(/^(#{1,4}\s+)\d+\\?\.\s*/gm, '$1')
}

function isExampleHeading(line: string): boolean {
  const normalized = line.replace(/^#{1,4}\s+/, '').trim().toLowerCase()
  return normalized.includes('列举例句') || normalized.includes('例句') || normalized.includes('example sentences')
}

function trySplitInline(text: string): { english: string; chinese: string } | null {
  // "English sentence.中文翻译" — 英文句号/感叹号/问号后紧跟中文字符
  const m = text.match(/^([A-Za-z].*?[.!?]["']?)\s*([\u4e00-\u9fff].*)$/)
  if (m) return { english: m[1].trim().replace(/^["']|["']$/g, ''), chinese: m[2].trim() }
  return null
}

function splitExampleParts(raw: string): { english: string; chinese: string } {
  const compact = raw.replace(/\s+/g, ' ').trim()

  // 1. （中文）括号格式
  const parenMatch = compact.match(/^(.*?)\s*[（(]\s*([\u4e00-\u9fff][^）)]*?)\s*[）)]\s*$/)
  if (parenMatch) {
    return {
      english: parenMatch[1].trim().replace(/^["']|["']$/g, ''),
      chinese: parenMatch[2].trim()
    }
  }

  // 2. English - 中文 / English: 中文 分隔符格式
  const dashMatch = compact.match(/^(.*?)\s*[-—:：]\s*([\u4e00-\u9fff].*)$/)
  if (dashMatch) {
    return {
      english: dashMatch[1].trim().replace(/^["']|["']$/g, ''),
      chinese: dashMatch[2].trim()
    }
  }

  // 3. "English.中文" 同行紧连格式（最常见的漏网情况）
  const inline = trySplitInline(compact)
  if (inline) return inline

  // 4. 多行：逐行判断，分别提取英文行和中文行
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const englishLine = lines.find((l) => /[A-Za-z]/.test(l)) ?? compact
  const chineseLines = lines.filter((l) => /[\u4e00-\u9fff]/.test(l) && l !== englishLine)

  // 再次尝试对找到的英文行做内联拆分
  const inlineOnLine = trySplitInline(englishLine)
  if (inlineOnLine) {
    return {
      english: inlineOnLine.english,
      chinese: [inlineOnLine.chinese, ...chineseLines].filter(Boolean).join(' ')
    }
  }

  return {
    english: englishLine.replace(/^["']|["']$/g, ''),
    chinese: chineseLines.join(' ').trim()
  }
}

function renderExampleSection(sectionLines: string[]): string {
  const items: string[] = []
  let currentItem: string[] = []

  const flushItem = () => {
    if (currentItem.length === 0) return
    const merged = currentItem.join('\n').trim()
    if (!merged) {
      currentItem = []
      return
    }

    const cleaned = merged
      .replace(/^\s*(?:\d+\.\s+|[*-]\s+)/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    const { english, chinese } = splitExampleParts(cleaned)

    if (english) {
      items.push(
        `<div class="example-entry"><p class="example-en">${md.utils.escapeHtml(english)}</p>${
          chinese ? `<p class="example-zh">${md.utils.escapeHtml(chinese)}</p>` : ''
        }</div>`
      )
    }

    currentItem = []
  }

  for (const line of sectionLines) {
    const trimmed = line.trim()

    if (!trimmed) {
      if (currentItem.length > 0) flushItem()
      continue
    }

    if (/^\s*\d+\.\s+/.test(trimmed)) {
      flushItem()
      currentItem.push(trimmed)
      continue
    }

    if (/^\s*[*-]\s+/.test(trimmed) && currentItem.length === 0) {
      currentItem.push(trimmed)
      continue
    }

    if (currentItem.length > 0) {
      currentItem.push(trimmed)
    }
  }

  flushItem()

  return items.length > 0 ? `\n<div class="example-list">\n${items.join('\n')}\n</div>\n` : sectionLines.join('\n')
}

function normalizeExampleSections(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    result.push(line)

    if (!isExampleHeading(line)) continue

    const sectionLines: string[] = []
    let j = i + 1

    while (j < lines.length && !/^#{1,4}\s+/.test(lines[j].trim())) {
      sectionLines.push(lines[j])
      j++
    }

    result.push(renderExampleSection(sectionLines))
    i = j - 1
  }

  return result.join('\n')
}

const renderedContent = computed(() => {
  if (!props.content) return ''
  return md.render(normalizeExampleSections(normalizeHeadings(props.content)))
})
</script>

<template>
  <div v-if="word" class="word-detail">
    <div class="detail-header">
      <div class="word-title">
        <h1>{{ word }}</h1>
        <SpeakButton :text="word" variant="soft-accent" />
      </div>
      <button
        v-if="showQueueButton !== false"
        class="btn"
        :class="inQueue ? 'btn-outline' : 'btn-primary'"
        @click="emit('toggle-queue')"
      >
        {{ inQueue ? '移出队列' : '+ 加入学习队列' }}
      </button>
    </div>
    <div class="detail-body">
      <div class="markdown-content detail-markdown" v-html="renderedContent" />
    </div>
  </div>
  <div v-else class="word-detail empty">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      style="color: var(--text-muted); margin-bottom: 10px; opacity: 0.5;"
    >
      <path
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-subtle);
}

.detail-header h1 {
  font-size: 44px;
  line-height: 1.08;
  font-weight: 750;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.word-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.detail-markdown:deep(h1),
.detail-markdown:deep(h2),
.detail-markdown:deep(h3),
.detail-markdown:deep(h4) {
  margin-top: 0;
  margin-bottom: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
  font-size: 15px;
  letter-spacing: 0.18em;
  font-weight: 700;
}

.detail-markdown:deep(h1:first-child),
.detail-markdown:deep(h2:first-child),
.detail-markdown:deep(h3:first-child),
.detail-markdown:deep(h4:first-child) {
  border-top: none;
  padding-top: 0;
}

.detail-markdown {
  /* 正文与小标题做轻微字号区分（小标题略大） */
  font-size: 14px;
}

.detail-markdown:deep(p) {
  margin: 10px 0;
}

.detail-markdown:deep(ol),
.detail-markdown:deep(ul) {
  margin: 8px 0 16px;
}

.detail-markdown:deep(.example-list) {
  margin-top: 6px;
}

.detail-markdown:deep(.example-entry) {
  padding: 14px 0 16px;
  border-top: 1px solid var(--border-subtle);
}

.detail-markdown:deep(.example-entry:first-child) {
  padding-top: 0;
  border-top: none;
}

.detail-markdown:deep(.example-en) {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: var(--text-primary);
}

.detail-markdown:deep(.example-zh) {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
