import { shallowRef } from "vue";
import { dataDictApi } from "@/api/system/dict";
import {
  defineListPage,
  formatPageColumns,
  type OperationProps,
  type PageTableColumn,
  type RePlusPageProps
} from "@/components/RePlusPage";
import {
  buildDictSearchColumnsFormat,
  dictBeforeSearchSubmit
} from "./dictSearch";
import { useDictRowActions } from "./useDictRowActions";
import { buildDictRowButtons } from "./dictRowButtons";
import { buildDictToolbarButtons } from "./dictToolbarButtons";
import { buildDictFormColumns } from "./dictFormColumns";
import {
  dictColorCellRenderer,
  dictFailureCellRenderer,
  dictLabelCellRenderer,
  dictLastUsedCellRenderer,
  dictLockedCellRenderer,
  dictParentCellRenderer,
  dictUsageCellRenderer
} from "./dictCellRenderers";

/**
 * 数据字典页：RePlusPage 树表（类型 → 字典项），含同层排序、批量启停与缓存刷新。
 *
 * 职责拆分：行内动作 useDictRowActions / 行内按钮 dictRowButtons.ts /
 * 工具栏按钮 dictToolbarButtons.ts / 列转换 dictColumnRules /
 * 单元格渲染 dictCellRenderers。
 */
export function useDataDict() {
  const page = defineListPage({
    api: dataDictApi,
    localeName: "dataDict",
    extraAuth: ["batchActive", "refreshCache", "move"]
  });
  const { api, auth, tableRef, t } = page;

  // 行内动作：勾选读取、同层排序、类型缓存刷新与新增子项预填
  const { refresh, getSelectedPks, onMove, onAddChild, onRefreshCache } =
    useDictRowActions({
      t,
      api,
      tableRef
    });

  /** 行内操作：新增子项 + 上移/下移 + 刷新本类型缓存（编辑/删除/详情为框架内建），见 dictRowButtons.ts */
  const operationButtonsProps = shallowRef<OperationProps>({
    // showNumber 与 width 放大到 6 / 420，保证六个按钮全部平铺不进「更多」
    showNumber: 6,
    width: 420,
    buttons: buildDictRowButtons({
      t,
      auth,
      onAddChild,
      onMove,
      onRefreshCache
    })
  });

  /** 工具栏：新增类型 + 批量启停 + 刷新缓存，见 dictToolbarButtons.ts */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: buildDictToolbarButtons({
      t,
      api,
      auth,
      tableRef,
      refresh,
      getSelectedPks
    })
  });

  /** 新增/编辑弹窗列调整见 dictFormColumns.ts */
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: buildDictFormColumns()
    }
  });

  const beforeSearchSubmit = dictBeforeSearchSubmit;
  const searchColumnsFormat = buildDictSearchColumnsFormat(t);

  /** 所属类型列与字典名列共用只读关联展示 */
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      parent: dictParentCellRenderer,
      parent_code: dictParentCellRenderer,
      label: dictLabelCellRenderer,
      color: dictColorCellRenderer,
      is_locked: dictLockedCellRenderer(t),
      usage_count: dictUsageCellRenderer,
      last_used_at: dictLastUsedCellRenderer,
      load_failure_count: dictFailureCellRenderer
    });

  return {
    ...page,
    addOrEditOptions,
    beforeSearchSubmit,
    searchColumnsFormat,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
