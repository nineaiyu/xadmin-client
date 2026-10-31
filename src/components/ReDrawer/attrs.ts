import type { DrawerOptions } from "./type";
import { overlayDomProps } from "@/components/overlay/domProps";

/**
 * ReDrawer 自有选项键（非 Element Plus `el-drawer` 属性）。
 *
 * 模板对 `el-drawer` 使用 `v-bind="drawerDomProps(options)"` 做属性透传：
 * 可枚举的函数 / 对象 / 数组会被 Vue 落成 DOM 属性字符串。新增 ReDrawer
 * 自有选项时必须同步本清单（`reDrawerAttrs.spec.ts` 有对账用例）。
 */
export const RE_DRAWER_INTERNAL_KEYS = [
  // 载荷通道
  "payload",
  "getData",
  "setData",
  // 渲染函数
  "headerRenderer",
  "contentRenderer",
  "footerRenderer",
  "footerButtons",
  // 内容组件 props
  "props",
  // 页脚 / 按钮行为
  "hideFooter",
  "popconfirm",
  "popConfirm",
  "sureBtnLoading",
  "sureBtnText",
  // 打开/关闭延迟由 overlay/store 自行消费，透传给 EP 会被二次延迟
  "openDelay",
  "closeDelay",
  "beforeCancel",
  "beforeSure",
  "beforeClose",
  // 生命周期回调
  "open",
  "close",
  "closeCallBack",
  "openAutoFocus",
  "closeAutoFocus",
  "onChange"
] as const;

/** 过滤出可安全 `v-bind` 到 `el-drawer` 的选项（规则见 overlay/domProps） */
export function drawerDomProps(
  options: DrawerOptions
): Record<string, unknown> {
  return overlayDomProps(options, RE_DRAWER_INTERNAL_KEYS);
}
