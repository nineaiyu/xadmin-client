import type { useI18n } from "vue-i18n";
import { openDialog } from "@/components/ReDialog/openDialog";
import PolicyPreviewPanel from "../components/PolicyPreviewPanel.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 登录访问策略的命中预演弹窗。
 *
 * 新增/编辑已迁至框架元数据表单（字段微调见 useLoginPolicyFormOptions），
 * 本模块只保留「预演」这一页面专属能力。
 */
export function useLoginPolicyDialogs({ t }: { t: TFunction }) {
  const openPreview = () => {
    openDialog({
      title: t("loginPolicy.previewTitle"),
      component: PolicyPreviewPanel,
      size: "lg",
      hideFooter: true,
      extra: { destroyOnClose: true }
    });
  };

  return { openPreview };
}
