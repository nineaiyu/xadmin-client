import { h, type VNode } from "vue";
import { ElTag } from "element-plus";

/**
 * 单元格视觉件（纯渲染函数）：数据字典与通用列表页共用，避免色块样式、
 * 内置徽章在两处各写一份。仅依赖 vue / element-plus，不牵连任何 api 模块，
 * 可被 RePlusPage 内部（renderers-detail）与业务页安全引用（无循环依赖）。
 */

/** 色块（14px 圆角方块）内联样式：色值字段列表/详情展示共用 */
export const colorBlockStyle = (color: string) => ({
  display: "inline-block",
  width: "14px",
  height: "14px",
  marginRight: "6px",
  borderRadius: "3px",
  background: color
});

/** 色值单元格：色块 + 色值；空值占位「—」 */
export const renderColorSwatch = (color?: string | null): VNode =>
  color
    ? h("span", { class: "flex items-center" }, [
        h("span", { style: colorBlockStyle(color) }),
        h("span", color)
      ])
    : h("span", "—");

/**
 * 内置/锁定徽章：warning 小标签，`active` 为 false 时回退占位文本。
 * `plain` 控制浅色描边形态（数据字典锁定用浅色，标签中心内置用默认）。
 */
export const renderBuiltinBadge = (
  active: boolean | undefined,
  text: string,
  options: { plain?: boolean; fallback?: string } = {}
): VNode =>
  active
    ? h(
        ElTag,
        {
          type: "warning",
          size: "small",
          effect: options.plain ? "plain" : "light"
        },
        () => text
      )
    : h("span", options.fallback ?? "-");
