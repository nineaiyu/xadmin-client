import { useI18n } from "vue-i18n";
import type { Ref } from "vue";
import { isSuccess } from "@/api/types";
import { dashboardApi, type DashboardItem } from "@/api/dataset/datasets";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";

/** 仪表盘删除（自页面抽出，控制单文件行数） */
export function useDashboardDelete({
  current,
  reload,
  syncQuery
}: {
  current: Ref<DashboardItem | null>;
  reload: () => Promise<void>;
  syncQuery: () => void;
}) {
  const { t } = useI18n();
  const confirm = useConfirm();

  const removeDashboard = async () => {
    if (!current.value) return;
    if (
      !(await confirm(
        t("dashboard.removeConfirm", { name: current.value.name }),
        { danger: true, draggable: true }
      ))
    ) {
      return;
    }
    const res = await dashboardApi
      .destroy(current.value.pk)
      .catch(normalizeError);
    if (isSuccess(res)) {
      current.value = null;
      await reload();
      syncQuery();
      return;
    }
    if (res.detail) message(String(res.detail), { type: "error" });
  };

  return { removeDashboard };
}
