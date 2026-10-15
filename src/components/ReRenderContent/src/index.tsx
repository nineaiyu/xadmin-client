import type { Component, PropType } from "vue";

import { defineComponent, h } from "vue";

import type { RenderContentType } from "./types";

/**
 * 内容渲染器：把「可能是字符串 / 数字 / 组件 / VNode」的值统一渲染为 VNode。
 *
 * 字符串与数字按**文本**渲染（不解析 HTML，无 XSS 面）；组件与 VNode 交给 `h()`；
 * `renderBr` 开启时字符串按换行拆成多个 `<p>`（多行文本展示）。
 * 不依赖 `any` 与组件注册表。
 */
export default defineComponent({
  name: "ReRenderContent",
  props: {
    content: {
      type: [String, Number, Object, Function] as PropType<
        RenderContentType | undefined
      >,
      default: undefined
    },
    renderBr: { type: Boolean, default: false }
  },
  setup(props, { attrs, slots }) {
    return () => {
      const raw: unknown = props.content;
      if (raw === null || raw === undefined || raw === "") {
        return null;
      }

      if (props.renderBr && typeof raw === "string") {
        // 多根渲染（多个 <p>）：attrs 在多根场景无处落点，Vue 会告警并丢弃，
        // 因此 renderBr 分支不接收透传属性（文本分段渲染本也不需要）
        return raw
          .split("\n")
          .map((line, index) => h("p", { key: index }, line));
      }

      if (typeof raw === "string" || typeof raw === "number") {
        return raw;
      }

      // 组件分支只透传调用方给的 attrs（不含本组件自身的 content/renderBr——
      // 它们是被渲染组件的未知属性，会被 Vue 落到 DOM 上）；props 键显式排除，
      // 与 attrs 合并由被渲染组件自行声明接收
      const { content: _content, renderBr: _renderBr, ...restProps } = props;
      return h(raw as Component, { ...attrs, props: restProps }, slots);
    };
  }
});
