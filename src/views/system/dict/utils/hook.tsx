import { getCurrentInstance, h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { dataDictApi } from "@/api/system/dict";
import { getDefaultAuths } from "@/router/utils";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import View from "~icons/ep/view";

/** 数据字典页：类型/字典项两级展示（parent 列显示类型 label，color 列标签预览） */
export function useDataDict(tableRef: Ref) {
  const api = reactive(dataDictApi);
  const auth = reactive({ ...getDefaultAuths(getCurrentInstance()) });
  const { t } = useI18n();

  /** 「查看子项」：把列表过滤收敛到该类型（写字段级 diff 于 searchFields.parent，
   * 搜索表单的所属类型下拉会同步回显，可直接清空恢复全部） */
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    buttons: [
      {
        text: t("dataDict.items"),
        code: "items",
        props: {
          type: "primary",
          icon: useRenderIcon(View),
          link: true
        },
        onClick: ({ row }) => {
          // 类型行看其子项；字典项行看同类型兄弟项（parent 输出为 {pk,label}）
          const parentPk = row?.parent?.pk ?? row?.pk;
          if (parentPk == null) return;
          if (tableRef.value?.searchFields) {
            tableRef.value.searchFields.parent = parentPk;
            tableRef.value.handleGetData();
          }
        },
        show: auth.list && 6
      }
    ]
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "parent":
          // 关联字段输出 {pk,label}，类型行（parent 为空）显示为字典类型
          column.cellRenderer = ({ row }) =>
            h("span", row.parent?.label ?? t("dataDict.dictType"));
          break;
        case "color":
          column.cellRenderer = ({ row }) =>
            row.color
              ? h(ElTag, { color: row.color, effect: "light" }, () => row.label)
              : h("span", row.label ?? "—");
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps
  };
}
