import type { DialogOptions } from "./type";
import { overlayDomProps } from "@/components/overlay/domProps";

/**
 * ReDialog 自有选项键（非 Element Plus `el-dialog` 属性）。
 *
 * 模板对 `el-dialog` 使用 `v-bind="options"` 做属性透传：可枚举的函数 / 对象 / 数组
 * 会被 Vue 落成 DOM 属性字符串（典型现场：`.el-dialog` 节点上出现
 * `headerrenderer="() => h(...)"`，组件内部 props 与渲染函数泄漏到 DOM）。
 * 这里把「框架自有」与「EP 原生」显式分开，只透传后者。
 *
 * 新增 ReDialog 自有选项时必须同步本清单（`attrs.spec.ts` 有对账用例）：
 * 漏登记会重新出现函数属性落到 DOM 的污染。
 */
export const RE_DIALOG_INTERNAL_KEYS = [
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
  "fullscreenCallBack",
  "openAutoFocus",
  "closeAutoFocus",
  "onChange",
  // 框架自有的全屏图标开关（EP 无该属性，全屏态由 :fullscreen 绑定）
  "fullscreenIcon"
] as const;

/**
 * 过滤出可安全 `v-bind` 到 `el-dialog` 的选项（规则见 overlay/domProps）。
 */
export function dialogDomProps(
  options: DialogOptions
): Record<string, unknown> {
  return overlayDomProps(options, RE_DIALOG_INTERNAL_KEYS);
}
