import { computed, getCurrentInstance, h, reactive, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { getDefaultAuths } from "@/router/utils";
import { maskApi } from "@/api/system/mask";
import type {
  OperationProps,
  PageTableColumn,
  RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import View from "~icons/ep/view";
import MaskPreview from "../components/MaskPreview.vue";

/** 字段级数据脱敏规则页：RePlusPage 元数据驱动列表，附自定义「脱敏预览」弹窗 */
export function useMask() {
  const api = reactive(maskApi);
  const auth = reactive({
    preview: false,
    ...getDefaultAuths(getCurrentInstance(), ["preview"])
  });
  const { t } = useI18n();

  /** 工具栏：新增/批量删除/导出/导入为框架内建，另加「脱敏预览」自定义弹窗 */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        code: "preview",
        text: t("mask.preview"),
        props: { type: "primary", icon: useRenderIcon(View), plain: true },
        onClick: () => {
          addDialog({
            title: t("mask.preview"),
            width: "40%",
            draggable: true,
            closeOnClickModal: false,
            hideFooter: true,
            contentRenderer: () => h(MaskPreview)
          });
        },
        show: auth.preview && 2
      }
    ]
  });

  /** 新增/编辑弹窗列调整：pattern（自定义正则）仅在 mask_type=custom 时展示 */
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        pattern: ({ column, formValue }) => {
          const isCustom = () => {
            const v = formValue.value?.mask_type;
            return v?.value === "custom" || v === "custom";
          };
          column["hideInForm"] = computed(() => !isCustom());
          return column;
        }
      }
    }
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "mask_type":
          // labeled_choice 可能为字符串或 {value,label}，做兼容展示
          column.cellRenderer = ({ row }) =>
            (row.mask_type as { label?: string })?.label ??
            row.mask_type ??
            "—";
          break;
        case "roles":
          // M2M 输出 [ {pk,name} ]，默认逗号连接名字展示
          column.cellRenderer = ({ row }) =>
            Array.isArray(row.roles)
              ? (row.roles as Array<{ name?: string }>)
                  .map(r => r?.name ?? "")
                  .filter(Boolean)
                  .join(", ") || "—"
              : (row.roles ?? "—");
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    tableBarButtonsProps
  };
}
