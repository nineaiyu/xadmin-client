import { h } from "vue";
import { ElTag } from "element-plus";
import type { useI18n } from "vue-i18n";
import type { TableColumnRenderer } from "@pureadmin/table";
import { dictTagProps } from "@/utils/dict";
import type { PageTableColumn } from "@/components/RePlusPage";
import type { DictCellRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 单元格渲染上下文：row 运行时必给（TableColumnRenderer 中标为可选），按读取字段收窄 */
const asCellRow = (scope: TableColumnRenderer) => scope.row as DictCellRow;

/**
 * 数据字典列表单元格渲染（纯函数，自 useDataDict 抽出）：
 * h 函数生成 VNode、无状态副作用；列装配流程见同目录 hook.tsx。
 */

/** 所属类型：编辑态为 {pk,label} 关联对象，列表态为只读编码，空值占位 */
export const dictParentCellRenderer = (column: PageTableColumn) => {
  column.cellRenderer = scope => {
    const row = asCellRow(scope);
    return h("span", row.parent?.label ?? row.parent_code ?? "—");
  };
};

/** 字典名：配了颜色即彩色 tag（统一取 dictTagProps，列表/详情同款），否则纯文本 */
export const dictLabelCellRenderer = (column: PageTableColumn) => {
  column.cellRenderer = scope => {
    const row = asCellRow(scope);
    return row.color
      ? h(ElTag, dictTagProps(row.color), () => row.label)
      : h("span", row.label ?? "—");
  };
};

/** 色值：色块 + 色值；表单侧由后端 ColorField（input_type=color）渲染颜色选择器 */
export const dictColorCellRenderer = (column: PageTableColumn) => {
  column.cellRenderer = scope => {
    const row = asCellRow(scope);
    return row.color
      ? h("span", { class: "flex items-center" }, [
          h("span", {
            style: {
              display: "inline-block",
              width: "14px",
              height: "14px",
              marginRight: "6px",
              borderRadius: "3px",
              background: row.color
            }
          }),
          h("span", row.color)
        ])
      : h("span", "—");
  };
};

/** 内置标记：warning plain tag，未内置占位 */
export const dictLockedCellRenderer =
  (t: TFunction) => (column: PageTableColumn) => {
    column.cellRenderer = scope => {
      const row = asCellRow(scope);
      return row.is_locked
        ? h(ElTag, { type: "warning", size: "small", effect: "plain" }, () =>
            t("dataDict.locked")
          )
        : h("span", "—");
    };
  };
