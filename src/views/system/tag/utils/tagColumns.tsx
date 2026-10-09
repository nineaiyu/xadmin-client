import { h } from "vue";
import { ElTag } from "element-plus";
import { SOLID_TAG_STYLE } from "@/utils/tagTone";
import { renderBuiltinBadge } from "@/utils/cellRender";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { TagItem } from "@/api/system/tag";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 标签列表列渲染（自 hook.tsx 抽出）：颜色列渲染为色块 tag（ElTag 的 color
 * 只改背景，需补文字色与去边框）、使用计数、内置标记。
 */
export function useTagColumns({ t }: { t: TFunction }) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      color: column => {
        column["cellRenderer"] = ({ row }) => {
          const color = (row as TagItem).color;
          return color
            ? h(ElTag, {
                size: "small",
                color,
                style: SOLID_TAG_STYLE
              })
            : h("span", "-");
        };
      },
      usage_count: column => {
        column["cellRenderer"] = ({ row }) => {
          const count = (row as TagItem).usage_count ?? 0;
          return h(
            ElTag,
            { size: "small", type: count ? "success" : "info" },
            () => String(count)
          );
        };
      },
      builtin: column => {
        column["cellRenderer"] = ({ row }) =>
          renderBuiltinBadge((row as TagItem).builtin, t("tag.builtin"), {
            fallback: "-"
          });
      }
    });

  return { listColumnsFormat };
}
