import type { DialogOptions } from "./type";

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

const INTERNAL = new Set<string>(RE_DIALOG_INTERNAL_KEYS);

/**
 * EP 原生属性中取值可为对象的例外（其余对象值一律视为框架配置对象剔除）：
 * - `style`：内联样式对象；
 * - `appendTo`：可选择器字符串或 DOM 元素；
 * - `transition`：过渡名字符串或配置对象；
 * - `closeIcon`：图标组件。
 */
const OBJECT_VALUED_EP_PROPS = new Set([
  "style",
  "appendTo",
  "transition",
  "closeIcon"
]);

/**
 * 过滤出可安全 `v-bind` 到 `el-dialog` 的选项：
 * - 剔除 ReDialog 自有键；
 * - 剔除值仍为函数 / 对象 / 数组的未知键（渲染函数与配置对象的兜底，
 *   它们在 DOM 上只会得到 `[object Object]` 或函数源码字符串）。
 *
 * 基础类型（string / number / boolean）原样保留——EP 的属性集合是开放的，
 * 这里不做白名单式收窄，避免新 EP 属性被误伤。
 */
export function dialogDomProps(
  options: DialogOptions
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (INTERNAL.has(key)) continue;
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }
    const type = typeof value;
    if (type === "string" || type === "number" || type === "boolean") {
      result[key] = value;
      continue;
    }
    if (OBJECT_VALUED_EP_PROPS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}
