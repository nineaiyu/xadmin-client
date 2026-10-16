import { shallowRef, type Ref, type UnwrapNestedRefs } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import View from "~icons/ep/view";
import type { OperationProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";
import type { roleApi } from "@/api/identity/role";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 角色页工具栏（批量更新）与行操作（权限预览）按钮装配（自 hook.tsx 抽出） */
export function useRoleButtons({
  t,
  api,
  tableRef,
  canPreview,
  openPreview
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof roleApi>;
  tableRef: Ref;
  canPreview?: boolean;
  openPreview: (row: RecordType) => void;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    // 160px 下 3 个按钮（编辑/删除/详情）换行使行高翻倍，200px 单行
    width: 200,
    buttons: [
      { code: "detail", show: false },
      {
        text: t("systemRole.preview"),
        code: "preview",
        props: {
          type: "primary",
          icon: useRenderIcon(View),
          link: true
        },
        onClick: ({ row }) => {
          openPreview(row);
        },
        show: canPreview
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
        label: t("commonLabels.is_active"),
        input_type: "boolean"
      }
    ]
  });
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [batchUpdateButton]
  });

  return { tableBarButtonsProps, operationButtonsProps };
}
