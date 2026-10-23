import { h } from "vue";
import { ElTag } from "element-plus";
import type { useI18n } from "vue-i18n";
import type { TableColumnRenderer } from "@pureadmin/table";
import { dictTagProps } from "@/utils/dict";
import { renderColorSwatch, renderBuiltinBadge } from "@/utils/cellRender";
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

/** 色值：色块 + 色值（与通用列表页 color 列共用渲染件）；表单侧由后端 ColorField 渲染颜色选择器 */
export const dictColorCellRenderer = (column: PageTableColumn) => {
  column.cellRenderer = scope => renderColorSwatch(asCellRow(scope).color);
};

/** 内置标记：warning plain tag，未内置占位 */
export const dictLockedCellRenderer =
  (t: TFunction) => (column: PageTableColumn) => {
    column.cellRenderer = scope =>
      renderBuiltinBadge(asCellRow(scope).is_locked, t("dataDict.locked"), {
        plain: true,
        fallback: "—"
      });
  };

/** 消费次数：类型行显示计数，字典项行/未消费显示占位 */
export const dictUsageCellRenderer = (column: PageTableColumn) => {
  column.cellRenderer = scope => {
    const count = asCellRow(scope).usage_count;
    if (count == null) return h("span", "—");
    return h(
      ElTag,
      { size: "small", type: count > 0 ? "primary" : "info", effect: "plain" },
      () => String(count)
    );
  };
};

/** 最近消费时间：ISO 字符串转本地可读展示 */
export const dictLastUsedCellRenderer = (column: PageTableColumn) => {
  column.cellRenderer = scope => {
    const value = asCellRow(scope).last_used_at;
    if (!value) return h("span", "—");
    return h("span", String(value).replace("T", " ").slice(0, 19));
  };
};

/** 消费加载失败次数：大于 0 用 danger tag 显式暴露（默认—） */
export const dictFailureCellRenderer = (column: PageTableColumn) => {
  column.cellRenderer = scope => {
    const count = asCellRow(scope).load_failure_count;
    if (count == null) return h("span", "—");
    return h(
      ElTag,
      {
        size: "small",
        type: count > 0 ? "danger" : "success",
        effect: "plain"
      },
      () => String(count)
    );
  };
};
