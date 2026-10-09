import { h } from "vue";
import { addDialog } from "@/components/ReDialog";
import MaskPreview from "../components/MaskPreview.vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 打开脱敏预览弹窗；传 rule 时预填当前行规则（列数据为掩码值，
 * 预览用于确认规则效果）。
 */
export function openMaskPreview({
  t,
  rule
}: {
  t: TFunction;
  rule?: Record<string, unknown>;
}) {
  addDialog({
    title: t("mask.preview"),
    width: "40%",
    draggable: true,
    closeOnClickModal: false,
    hideFooter: true,
    props: rule ? { rule } : {},
    contentRenderer: () => h(MaskPreview)
  });
}
