import { shallowRef } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import View from "~icons/ep/view";
import { buildPreviewRule } from "./maskModelFieldOptions";
import { openMaskPreview } from "./maskPreviewDialog";
import type { OperationProps } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 脱敏规则页按钮装配（自 hook.tsx 抽出）：工具栏「脱敏预览」（空规则预演）
 * 与行内「脱敏预览」（预填当前行规则）。
 */
export function useMaskButtons({
  t,
  canPreview
}: {
  t: TFunction;
  canPreview?: boolean;
}) {
  /** 工具栏：新增/批量删除/导出/导入为框架内建，另加「脱敏预览」自定义弹窗 */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        code: "preview",
        text: t("mask.preview"),
        props: { type: "primary", icon: useRenderIcon(View), plain: true },
        onClick: () => openMaskPreview({ t }),
        index: 2,
        show: canPreview
      }
    ]
  });

  /** 行内操作：以当前行规则打开预览（列数据为掩码值，预览用于确认规则效果） */
  const operationButtonsProps = shallowRef<OperationProps>({
    // 放大到 6 / 300，保证内建按钮与「脱敏预览」平铺展示，不落进「更多」
    showNumber: 6,
    width: 300,
    buttons: [
      {
        code: "preview",
        text: t("mask.preview"),
        props: { type: "primary", icon: useRenderIcon(View), link: true },
        onClick: ({ row }) =>
          openMaskPreview({ t, rule: buildPreviewRule(row as RecordType) }),
        index: -15,
        show: canPreview
      }
    ]
  });

  return { tableBarButtonsProps, operationButtonsProps };
}
