import { getCurrentInstance, h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { dataDictApi, type MoveDirection } from "@/api/system/dict";
import { getDefaultAuths } from "@/router/utils";
import { message } from "@/utils/message";
import {
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

/** 数据字典行：parent 为空 = 字典类型，非空 = 字典项（模型只支持两级） */
type DictRow = {
  pk?: string | number;
  label?: string;
  color?: string | null;
  parent_code?: string | null;
  parent?: { pk?: string | number; label?: string } | string | number | null;
  is_locked?: boolean;
  children?: DictRow[];
};

/** 数据字典页：RePlusPage 树表（类型 → 字典项），含同层排序、批量启停与缓存刷新 */
export function useDataDict(tableRef: Ref) {
  const api = reactive(dataDictApi);
  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance(), [
      "batchActive",
      "refreshCache",
      "move"
    ])
  });
  const { t } = useI18n();

  const refresh = () => tableRef.value?.handleGetData();

  /** 仅类型行可挂字典项：序列化器 parent 查询集已限定类型层，杜绝三级结构 */
  const isTypeRow = (row: DictRow) => !row?.parent;

  /** 勾选行主键，空勾选时给出提示并返回 null */
  const getSelectedPks = (): Array<string | number> | null => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return null;
    }
    return pks;
  };

  /** 同层上移/下移：服务端按 sort 重排整层（跨分页也成立），成功后刷新列表 */
  const onMove = (
    row: DictRow,
    direction: MoveDirection,
    loading?: { value: boolean }
  ) => {
    if (loading) loading.value = true;
    handleOperation({
      t,
      apiReq: api.move(row?.pk, direction),
      success() {
        refresh();
      },
      requestEnd() {
        if (loading) loading.value = false;
      }
    });
  };

  /** 行内「新增子项」：仅类型行可用，复用 CRUD 弹窗并预填所属类型。
   * 预填值必须是与编辑态一致的 {pk,label} 对象（列表行 parent 即此形态），
   * 传字符串 pk 时下拉回显会裸显 uuid 而匹配不到类型选项 */
  const onAddChild = (row: DictRow) =>
    tableRef.value?.handleAddOrEdit(true, {
      parent: row?.pk ? { pk: row.pk, label: row.label } : undefined
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
        show: row => Boolean(auth.create && isTypeRow(row)) && -40
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
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.refreshCache && 3
      }
    ]
  });

  /** 新增/编辑弹窗列调整：主键与系统内置标记不进表单，类型行隐藏「所属类型/字典值」，
   * 内置字典（is_locked）锁死编码与所属类型——改 code 会让代码里的引用断链 */
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        pk: ({ column }) => ({ ...column, hideInForm: true }),
        is_locked: ({ column }) => ({ ...column, hideInForm: true }),
        code: ({ column, rawRow }) => {
          if (rawRow?.is_locked) {
            column["fieldProps"] = { ...column["fieldProps"], disabled: true };
          }
          return column;
        },
        parent: ({ column, rawRow, isAdd }) => {
          // 类型行没有「所属类型」概念（新建时留空即创建类型层）
          if (isTypeRow(rawRow)) {
            column["hideInForm"] = true;
            return column;
          }
          // 内置字典锁死所属类型；新增子项时所属类型由父行决定，也不可改
          if (rawRow?.is_locked || (isAdd && rawRow?.parent)) {
            column["fieldProps"] = { ...column["fieldProps"], disabled: true };
          }
          return column;
        },
        // 字典值仅字典项使用；类型行隐藏
        value: ({ column, rawRow }) => {
          if (isTypeRow(rawRow)) column["hideInForm"] = true;
          return column;
        }
      }
    }
  });

  /** 列表按 sort 升序（与消费端 items 同序）：框架默认 ordering 为 -created_time，
   * 对「排序即语义」的字典没有意义 */
  const beforeSearchSubmit = (params: Record<string, unknown>) => ({
    ...params,
    ordering: "sort,created_time"
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "parent":
        case "parent_code":
          // 所属类型：编辑态为 {pk,label} 关联对象，列表态为只读编码，空值占位
          column.cellRenderer = ({ row }) =>
            h("span", row.parent?.label ?? row.parent_code ?? "—");
          break;
        case "label":
          // 与 labeled_choice 渲染保持一致：配了颜色即彩色 tag，否则纯文本
          column.cellRenderer = ({ row }) =>
            row.color
              ? h(
                  ElTag,
                  {
                    color: row.color,
                    style: { border: "none", color: "#fff" }
                  },
                  () => row.label
                )
              : h("span", row.label ?? "—");
          break;
        case "color":
          // 色块 + 色值；表单侧由后端 ColorField（input_type=color）渲染颜色选择器
          column.cellRenderer = ({ row }) =>
            row.color
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
          break;
        case "is_locked":
          column.cellRenderer = ({ row }) =>
            row.is_locked
              ? h(
                  ElTag,
                  { type: "warning", size: "small", effect: "plain" },
                  () => t("dataDict.locked")
                )
              : h("span", "—");
          break;
      }
    });
    return columns;
  };

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
