import { h } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import type { OperationProps } from "@/components/RePlusPage";
import TrialPanel from "../components/TrialPanel.vue";
import type { usePermissionLookups } from "./usePermissionLookups";

/**
 * 列表页只读试算入口：不进入编辑即可确认规则命中范围。
 * 试算面板复用编辑态的 TrialPanel（传行上的已保存规则与菜单上下文）。
 */
export function usePermissionTrialAction(
  lookups: ReturnType<typeof usePermissionLookups>
) {
  const { t } = useI18n();
  // 试算能力归属于 SystemUser 域：无权限时保留入口并用提示说明依赖，
  // 而不是整颗按钮消失（用户无从得知为什么没有试算）
  const canTrial = hasAuth("previewTrial:SystemUser");

  const trialButton: NonNullable<OperationProps["buttons"]>[number] = {
    text: t("systemPermission.trial"),
    code: "trial",
    props: { type: "primary", plain: true, link: true },
    tooltip: {
      content: canTrial
        ? t("systemPermission.trialReadonlyHint")
        : t("systemPermission.trialPermissionRequired")
    },
    show: () => true,
    onClick: ({ row }) => {
      if (!canTrial) {
        message(t("systemPermission.trialPermissionRequired"), {
          type: "warning"
        });
        return;
      }
      addDialog({
        title: t("systemPermission.trialTitle", {
          name: String(row.name ?? "")
        }),
        width: dialogSize("lg"),
        hideFooter: true,
        destroyOnClose: true,
        contentRenderer: () =>
          h(TrialPanel, {
            rules: (row.rules ?? []) as never,
            ruleList: lookups.fieldLookupsData.value,
            fieldRuleList: lookups.fieldLookupsRole.value,
            menus: lookups.menuContextOptions.value,
            formValue: row
          })
      });
    }
  };

  return { trialButton };
}
