/**
 * 读屏播报（R5）：把异步操作结果写入全局 aria-live 区域（视觉隐藏）。
 *
 * - 挂载点：布局层 `lay-content/index.vue` 的 `#a11y-live`（role="status" + aria-live="polite"）；
 * - 区域不存在（如未进入主布局的登录页）时静默降级，不影响业务流程；
 * - 相同文本连续播报需「先清空再写入」，否则读屏不会重复朗读；异步写入避免
 *   与写入之间被浏览器合并成一次变更。
 */
export function announce(message: string): void {
  const text = (message ?? "").trim();
  if (!text) return;
  const region = document.getElementById("a11y-live");
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = text;
  }, 50);
}
