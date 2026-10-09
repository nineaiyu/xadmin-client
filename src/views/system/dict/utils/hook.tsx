import { reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { dataDictApi } from "@/api/system/dict";
import { usePageAuth } from "@/router/utils";
import {
  formatPageColumns,
  type OperationProps,
  type PageTableColumn,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import { useDictRowActions } from "./useDictRowActions";
import { buildDictRowButtons } from "./dictRowButtons";
import { buildDictToolbarButtons } from "./dictToolbarButtons";
import { buildDictFormColumns } from "./dictFormColumns";
import {
  dictColorCellRenderer,
  dictLabelCellRenderer,
  dictLockedCellRenderer,
  dictParentCellRenderer
} from "./dictCellRenderers";

/**
 * 数据字典页：RePlusPage 树表（类型 → 字典项），含同层排序、批量启停与缓存刷新。
 *
 * 职责拆分：行内动作 useDictRowActions / 行内按钮 dictRowButtons.ts /
 * 工具栏按钮 dictToolbarButtons.ts / 列转换 dictColumnRules /
 * 单元格渲染 dictCellRenderers。
 */
export function useDataDict(tableRef: Ref) {
  const api = reactive(dataDictApi);
  const auth = usePageAuth(["batchActive", "refreshCache", "move"]);
  const { t } = useI18n();

  // 行内动作：勾选读取、同层排序与新增子项预填
  const { refresh, getSelectedPks, onMove, onAddChild } = useDictRowActions({
    t,
    api,
    tableRef
  });

  // 批量更新：勾选行后统一写入同组字段（字段白名单：启用状态）
  const { batchUpdateButton } = useBatchUpdate({
    t,
    api,
    tableRef,
    fields: [
      {
        key: "is_active",
        label: t("dataDict.is_active"),
        input_type: "boolean"
      }
    ]
  });

  /** 行内操作：新增子项 + 上移/下移（编辑/删除/详情为框架内建），见 dictRowButtons.ts */
  const operationButtonsProps = shallowRef<OperationProps>({
    // showNumber 与 width 放大到 6 / 420，保证六个按钮全部平铺不进「更多」
    showNumber: 6,
    width: 420,
    buttons: buildDictRowButtons({ t, auth, onAddChild, onMove })
  });

  /** 工具栏：新增类型 + 批量启停 + 刷新缓存，见 dictToolbarButtons.ts */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: buildDictToolbarButtons({
      t,
      api,
      auth,
      tableRef,
      refresh,
      getSelectedPks,
      batchUpdateButton
    })
  });

  /** 新增/编辑弹窗列调整见 dictFormColumns.ts */
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: buildDictFormColumns()
    }
  });

  /** 列表按 sort 升序（与消费端 items 同序）：框架默认 ordering 为 -created_time，
   * 对「排序即语义」的字典没有意义 */
  const beforeSearchSubmit = (params: Record<string, unknown>) => ({
    ...params,
    ordering: "sort,created_time"
  });

  /** 所属类型列与字典名列共用只读关联展示 */
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      parent: dictParentCellRenderer,
      parent_code: dictParentCellRenderer,
      label: dictLabelCellRenderer,
      color: dictColorCellRenderer,
      is_locked: dictLockedCellRenderer(t)
    });

  return {
    api,
    auth,
    addOrEditOptions,
    beforeSearchSubmit,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
