/**
 * 平台标记：把运行平台写入 `<html data-platform>`（`macOs` / `window`），
 * 供平台差异化的全局样式消费——典型是滚动条（macOS 用系统覆盖式滚动条，
 * 不能强加自定义 webkit 滚动条，否则会常驻显示，见 `style/reset.scss`）。
 * 对齐 vben 的 `initPlatform`。
 */
export function detectPlatform(): "macOs" | "window" {
  const source = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
  return /mac/i.test(source) ? "macOs" : "window";
}

/** 写入 `<html data-platform>`；应在应用挂载前调用（首屏样式即可命中守卫）。 */
export function initPlatform(): void {
  document.documentElement.dataset.platform = detectPlatform();
}
