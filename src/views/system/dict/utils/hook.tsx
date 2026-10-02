import { reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { dataDictApi } from "@/api/system/dict";
import { usePageAuth } from "@/views/system/hooks";
import { clearDictCache } from "@/utils/dict";
import {
  formatPageColumns,
  handleOperation,
  type OperationProps,
  type PageTableColumn,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AddFill from "~icons/ri/add-circle-line";
import ArrowUp from "~icons/ep/arrow-up-bold";
import ArrowDown from "~icons/ep/arrow-down-bold";
import CircleCheck from "~icons/ep/circle-check";
import CircleClose from "~icons/ep/circle-close";
import Refresh from "~icons/ep/refresh";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import { useDictRowActions } from "./useDictRowActions";
import {
  dictCodeColumnTransform,
  dictParentColumnTransform,
  dictValueColumnTransform,
  isDictTypeRow
} from "./dictColumnRules";
import {
  dictColorCellRenderer,
  dictLabelCellRenderer,
  dictLockedCellRenderer,
  dictParentCellRenderer
} from "./dictCellRenderers";

/** 数据字典页：RePlusPage 树表（类型 → 字典项），含同层排序、批量启停与缓存刷新 */
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

  /** 行内操作：新增子项（-40，类型行专属）+ 上移/下移（编辑/删除/详情为框架内建）
   * showNumber 与 width 放大到 6 / 380，保证六个按钮全部平铺不进「更多」 */
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 6,
    width: 420,
    buttons: [
      {
        text: t("dataDict.addChild"),
        code: "addChild",
        props: { type: "primary", icon: useRenderIcon(AddFill), link: true },
        onClick: ({ row }) => onAddChild(row),
        show: row => Boolean(auth.create && isDictTypeRow(row)) && -40
      },
      {
        text: t("dataDict.moveUp"),
        code: "moveUp",
        props: { type: "info", icon: useRenderIcon(ArrowUp), link: true },
        onClick: ({ row, loading }) => onMove(row, "up", loading),
        show: auth.move && 2
      },
      {
        text: t("dataDict.moveDown"),
        code: "moveDown",
        props: { type: "info", icon: useRenderIcon(ArrowDown), link: true },
        onClick: ({ row, loading }) => onMove(row, "down", loading),
        show: auth.move && 3
      }
    ]
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

  /** 工具栏：新增（覆盖内建 create，parent 留空即字典类型）+ 批量启停 + 刷新缓存 */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("dataDict.addType"),
        code: "create",
        props: { type: "primary", icon: useRenderIcon(AddFill) },
        onClick: () => tableRef.value?.handleAddOrEdit(true, {}),
        show: auth.create && -30
      },
      {
        text: t("dataDict.batchActive"),
        code: "batchActive",
        confirm: { title: t("dataDict.batchActiveConfirm") },
        props: {
          type: "success",
          icon: useRenderIcon(CircleCheck),
          plain: true
        },
        onClick: ({ loading }) => {
          const pks = getSelectedPks();
          if (!pks) return;
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.batchActive(pks, true),
            success() {
              refresh();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.batchActive && 1
      },
      {
        text: t("dataDict.batchInactive"),
        code: "batchInactive",
        confirm: { title: t("dataDict.batchInactiveConfirm") },
        props: {
          type: "warning",
          icon: useRenderIcon(CircleClose),
          plain: true
        },
        onClick: ({ loading }) => {
          const pks = getSelectedPks();
          if (!pks) return;
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.batchActive(pks, false),
            success() {
              refresh();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.batchActive && 2
      },
      {
        text: t("dataDict.refreshCache"),
        code: "refreshCache",
        props: { type: "info", icon: useRenderIcon(Refresh), plain: true },
        onClick: ({ loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.refreshCache(),
            success() {
              // 同步清空前端进程内字典缓存：否则其他页面在 5 分钟 TTL 内仍读旧字典
              // （成功提示由 handleOperation 统一给出，重复 message 会弹两次）
              clearDictCache();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.refreshCache && 3
      },
      batchUpdateButton
    ]
  });

  /** 新增/编辑弹窗列调整：主键与系统内置标记不进表单，类型行隐藏「所属类型/字典值」，
   * 内置字典（is_locked）锁死编码与所属类型——改 code 会让代码里的引用断链
   * （转换规则见 dictColumnRules，纯函数可单测直测） */
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        pk: ({ column }) => ({ ...column, hideInForm: true }),
        is_locked: ({ column }) => ({ ...column, hideInForm: true }),
        code: ({ column, rawRow }) =>
          dictCodeColumnTransform({ column, rawRow }),
        parent: ({ column, rawRow, isAdd }) =>
          dictParentColumnTransform({ column, rawRow, isAdd }),
        // 字典值仅字典项使用；类型行隐藏
        value: ({ column, rawRow }) =>
          dictValueColumnTransform({ column, rawRow })
      }
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
