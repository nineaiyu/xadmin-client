import { h } from "vue";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

import { addDialog } from "@/components/ReDialog";
import ImBindingPanel from "../components/ImBindingPanel.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 管理员代录 IM 账号弹窗（免扫码）：面板内完成绑定/解绑与列表回显，
 * 因此隐藏弹窗默认底部按钮（hideFooter）；写操作后端落审计（module=IM:binding）。
 */
export function useUserImBinding({ t }: { t: TFunction }) {
  function handleImBinding(row: RecordType) {
    addDialog({
      title: t("imBinding.title", { user: row.username }),
      width: "560px",
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(ImBindingPanel, { row })
    });
  }

  return { handleImBinding };
}
