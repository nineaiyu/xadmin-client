import type { Component, VNode } from "vue";

export type RenderContentType = Component | VNode | string | number | null;

export interface ReRenderContentProps {
  /** 渲染内容：字符串 / 数字按文本渲染；组件 / VNode 交给 h() 渲染 */
  content?: RenderContentType;
  /** 字符串按换行拆成多个 `<p>`（多行文本场景） */
  renderBr?: boolean;
}
