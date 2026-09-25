import type { CSSProperties } from "vue";

/**
 * 自定义色 tag 的实心样式（字典色 / 标签色 / 请假类型色等场景共用）。
 *
 * ElTag 的 `color` 只覆盖背景色，文字色与边框仍取默认 primary 语义色（蓝），
 * 不补样式就会出现「自定义底色 + 蓝字蓝边」，与配置处所见不一致。
 *
 * 文字色取 `--el-color-white`（EP 未在暗色主题重定义该变量，与写死 #fff 行为等价），
 * 集中定义避免各渲染器各写一份字面量。
 */
export const SOLID_TAG_STYLE: CSSProperties = {
  border: "none",
  color: "var(--el-color-white)"
};
