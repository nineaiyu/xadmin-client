import { h } from "vue";
import { ElTag } from "element-plus";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";

/**
 * 书籍列表列渲染（自 hook.tsx 抽出）：分类标签、上架状态语义色、售价格式化；
 * 搜索区与编辑表单的出版社自动补全见 bookFormColumns.ts。
 */
export function useBookColumns() {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      category: column => {
        column["cellRenderer"] = ({ row }) => {
          return h(ElTag, { type: "success" }, () => row.category.label);
        };
      },
      status: column => {
        // 上架状态（后端 choices 下发为 {value,label}）：按状态渲染彩色标签
        const statusTagTypes: Record<
          string,
          "success" | "warning" | "info" | "danger"
        > = {
          DRAFT: "info",
          PENDING: "warning",
          ON_SHELF: "success",
          REJECTED: "danger"
        };
        column["cellRenderer"] = ({ row }) => {
          const status = row.status;
          return h(
            ElTag,
            { type: statusTagTypes[status?.value] ?? "info" },
            () => status?.label ?? status
          );
        };
      },
      price: column => {
        // 售价格式化渲染（自定义单元格的又一示例）
        column["cellRenderer"] = ({ row }) =>
          h("span", `￥${Number(row.price ?? 0).toFixed(2)}`);
      }
    });

  return { listColumnsFormat };
}
