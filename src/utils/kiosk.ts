/**
 * 展板（kiosk）态判定：无 layout 的全屏展示页（如大屏投屏）在路由 `meta.kiosk`
 * 标记后进入「静默展示」——站点级浮层（应用内通知 / 桌面通知）一律不弹，
 * 否则公告横幅会直接盖住投屏内容。
 *
 * 只做元数据判定（不读路由实例）：调用方传入 `route.meta`，便于单测直接构造。
 * 未读计数与推送连接不受影响，离开展板后角标自然正确。
 */
export function isKioskMeta(
  meta: { kiosk?: boolean } | null | undefined
): boolean {
  return meta?.kiosk === true;
}
