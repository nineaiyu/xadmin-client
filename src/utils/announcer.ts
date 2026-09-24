/**
 * 读屏播报（R5）：把异步操作结果写入全局 aria-live 区域（视觉隐藏）。
 *
 * - 挂载点：布局层 `lay-content/index.vue` 的 `#a11y-live`（role="status" + aria-live="polite"）；
 * - 区域不存在（如未进入主布局的登录页）时静默降级，不影响业务流程；
 * - 相同文本连续播报需「先清空再写入」，否则读屏不会重复朗读；异步写入避免
 *   与写入之间被浏览器合并成一次变更；
 * - 文本读完即清空：该区域跨路由常驻 DOM，若不清空，最后一条文案会一直留在
 *   可访问性树里，读屏在焦点变化/树重算时会反复朗读早已过期的内容。
 */

/** 写入 / 清空定时器句柄：连续播报时先撤销上一次，避免旧文案被残留定时器写回 */
let writeTimer: number | undefined;
let clearTimer: number | undefined;

/** 文本驻留时长：读屏朗读需要时间，按长度自适应（下限 1.2s，上限 8s） */
const dwellOf = (text: string) => Math.min(8000, 1200 + text.length * 60);

export function announce(message: string): void {
  const text = (message ?? "").trim();
  if (!text) return;
  const region = document.getElementById("a11y-live");
  if (!region) return;
  window.clearTimeout(writeTimer);
  window.clearTimeout(clearTimer);
  // 先清空：同一条文案连续播报也能触发一次真实的文本变更
  region.textContent = "";
  writeTimer = window.setTimeout(() => {
    region.textContent = text;
    // 读完清空文本、保留容器：容器必须常驻可访问性树才能持续播报
    clearTimer = window.setTimeout(() => {
      region.textContent = "";
    }, dwellOf(text));
  }, 50);
}
