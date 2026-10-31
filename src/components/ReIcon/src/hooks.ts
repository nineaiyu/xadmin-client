import type { Component } from "vue";

import { resolveIconComponent } from "./iconCache";
import type { iconType } from "./types";

/**
 * 支持 `iconfont`、`SVG` 字符串、`SVG` 函数组件、图片 `URL` 以及 `iconify` 中所有的图标
 * @see 点击查看文档图标篇 {@link https://pure-admin.cn/pages/icon/}
 * @param icon 必传 图标（字符串 / 组件 / 图标数据对象）
 * @param attrs 可选 iconType 属性
 * @returns Component
 */
export function useRenderIcon(
  icon: string | Component | Record<string, unknown>,
  attrs?: iconType
): Component {
  return resolveIconComponent(icon, attrs);
}
