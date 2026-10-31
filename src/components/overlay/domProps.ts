/**
 * 弹层属性透传规则（ReDialog / ReDrawer 共用）。
 *
 * 模板对 `el-dialog` / `el-drawer` 使用 `v-bind` 做属性透传：可枚举的函数 /
 * 对象 / 数组会被 Vue 落成 DOM 属性字符串（典型现场：节点上出现
 * `headerrenderer="() => h(...)"`）。这里只透传 Element Plus 原生属性：
 * 框架自有键剔除，函数 / 对象兜底剔除。
 */

/** EP 原生属性中取值可为对象的例外（其余对象值一律视为框架配置对象剔除） */
const OBJECT_VALUED_EP_PROPS = new Set([
  "style",
  "appendTo",
  "transition",
  "closeIcon"
]);

/**
 * 过滤出可安全 `v-bind` 到 Element Plus 弹层的选项：
 * - 剔除调用方声明的框架自有键；
 * - 剔除值仍为函数 / 对象 / 数组的未知键；
 * - 基础类型（string / number / boolean）原样保留（EP 属性集合是开放的，
 *   不做白名单式收窄，避免新 EP 属性被误伤）。
 */
export function overlayDomProps(
  options: object,
  internalKeys: readonly string[]
): Record<string, unknown> {
  const internal = new Set(internalKeys);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (internal.has(key)) continue;
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

/** 页脚按钮的框架语义键：不可透传到 `<button>`（loader / 气泡配置 / 事件） */
const BUTTON_INTERNAL_KEYS = new Set([
  "label",
  "code",
  "btnClick",
  "popconfirm",
  "popConfirm"
]);

/** 过滤出可安全 `v-bind` 到 `el-button` 的页脚按钮属性 */
export function buttonDomProps<T extends object>(btn: T) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(btn)) {
    if (BUTTON_INTERNAL_KEYS.has(key)) continue;
    result[key] = value;
  }
  return result;
}
