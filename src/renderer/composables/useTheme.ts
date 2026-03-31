import { ref, watch } from "vue"
type Theme = "dark" | "light"
const STORAGE_KEY = "word-learner-theme"
const theme = ref<Theme>((localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark")
function applyTheme(t: Theme) {
  if (t === "light") {
    document.documentElement.setAttribute("data-theme", "light")
  } else {
    document.documentElement.removeAttribute("data-theme")
  }
}
watch(theme, (t) => { applyTheme(t); localStorage.setItem(STORAGE_KEY, t) }, { immediate: true })
export function useTheme() {
  function toggle() { theme.value = theme.value === "dark" ? "light" : "dark" }
  return { theme, toggle }
}
