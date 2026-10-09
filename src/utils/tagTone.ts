import { h, type CSSProperties } from "vue";
import { ElTag } from "element-plus/es/components/tag/index.mjs";
import type { TagItem } from "@/api/system/tag";

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

/**
 * 通用标签列渲染（用户 / 文件 / 审批实例等可打标列表共用）。
 *
 * tags 是数组字段，框架对数组只做 String 化，需页面自渲染；cellRenderer scope
 * 的 `props` 来自操作列 slot（含 size），缺省时 ElTag 走默认尺寸。
 */
export function renderTagsCell(scope: {
  row?: { tags?: TagItem[] | null };
  props?: { size?: "default" | "small" | "large" };
}) {
  const tags = scope.row?.tags ?? [];
  if (!tags.length) return h("span", "-");
  return h(
    "div",
    { class: "flex flex-wrap items-center gap-1" },
    tags.map(tag =>
      h(
        ElTag,
        {
          key: tag.pk,
          size: scope.props?.size,
          color: tag.color || undefined,
          style: tag.color ? SOLID_TAG_STYLE : undefined
        },
        () => tag.name
      )
    )
  );
}
