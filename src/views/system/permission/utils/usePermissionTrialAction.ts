import { h } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
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

  const trialButton: NonNullable<OperationProps["buttons"]>[number] = {
    text: t("systemPermission.trial"),
    code: "trial",
    props: { type: "primary", plain: true, link: true },
    show: () => hasAuth("previewTrial:SystemUser"),
    onClick: ({ row }) => {
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
