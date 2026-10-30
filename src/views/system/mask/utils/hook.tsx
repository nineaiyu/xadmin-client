import { shallowRef } from "vue";
import { hasAuth } from "@/router/utils";
import { maskApi } from "@/api/system/mask";
import {
  defineListPage,
  formatPageColumns,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useMaskModelFieldOptions } from "./maskModelFieldOptions";
import { buildMaskFormColumns } from "./maskFormColumns";
import { useMaskButtons } from "./useMaskButtons";

export { buildPreviewRule } from "./maskModelFieldOptions";

/**
 * 字段级数据脱敏规则页：RePlusPage 元数据驱动列表，附自定义「脱敏预览」弹窗。
 *
 * 职责拆分：模型/字段候选与预览规则提取 maskModelFieldOptions.ts、
 * 预览弹窗 maskPreviewDialog.ts、表单列 maskFormColumns.ts、
 * 按钮 useMaskButtons.ts。
 */
export function useMask() {
  /** 模型/字段候选来自模型字段字典；无该权限时退回手填（下拉降级为输入框） */
  const canPickModel = hasAuth("list:SystemModelLabelField");
  const { modelOptions, fieldOptionsMap } = useMaskModelFieldOptions({
    canPickModel
  });

  return defineListPage({
    api: maskApi,
    localeName: "mask",
    extraAuth: ["preview"],
    columns: ({ columns }) =>
      formatPageColumns(columns, {
        mask_type: column => {
          // labeled_choice 可能为字符串或 {value,label}，做兼容展示
          column.cellRenderer = ({ row }) =>
            (row.mask_type as { label?: string })?.label ??
            row.mask_type ??
            "—";
        },
        roles: column => {
          // M2M 输出 [ {pk,name} ]，默认逗号连接名字展示
          column.cellRenderer = ({ row }) =>
            Array.isArray(row.roles)
              ? (row.roles as Array<{ name?: string }>)
                  .map(r => r?.name ?? "")
                  .filter(Boolean)
                  .join(", ") || "—"
              : (row.roles ?? "—");
        }
      }),
    /** 新增/编辑弹窗列调整（模型/字段候选 + pattern 条件展示）见 maskFormColumns.ts */
    formOptions: () =>
      shallowRef<RePlusPageProps["addOrEditOptions"]>({
        props: {
          columns: buildMaskFormColumns({
            canPickModel,
            modelOptions,
            fieldOptionsMap
          })
        }
      }),
    buttons: ({ t, auth }) => useMaskButtons({ t, canPreview: auth.preview })
  });
}
