import { h, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import { message } from "@/utils/message";
import type { DataEnvelope } from "@/api/types";
import type {
  MonitorEventsParams,
  MonitorThresholds
} from "@/api/system/monitor";
import ThresholdForm from "../components/ThresholdForm.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 阈值设置弹窗（自 monitor/index.vue 抽出，控制页面行数）：
 * 无独立读权限时明确提示「无权限」，有权限但加载失败才提示「不可用」。
 */
export function useThresholdDialog({
  t,
  thresholds,
  saveThresholds,
  fetchThresholds,
  fetchAlerts,
  alertStatus
}: {
  t: TFunction;
  thresholds: Ref<MonitorThresholds | null>;
  saveThresholds: (values: Record<string, number>) => Promise<DataEnvelope>;
  fetchThresholds: () => void | Promise<void>;
  fetchAlerts: (
    params?: Omit<MonitorEventsParams, "kind">
  ) => void | Promise<void>;
  alertStatus: Ref<"" | "firing" | "resolved">;
}) {
  const thresholdFormRef = ref<InstanceType<typeof ThresholdForm>>();
  const canReadThresholds = hasAuth("thresholds:SystemMonitor");

  const openThresholdDialog = () => {
    if (!canReadThresholds) {
      message(t("systemMonitor.thresholdNoPermission"), { type: "warning" });
      return;
    }
    if (!thresholds.value?.items?.length) {
      message(t("systemMonitor.thresholdUnavailable"), { type: "warning" });
      return;
    }
    thresholdFormRef.value = undefined;
    const { beforeSure } = useDialogForm<Record<string, number>>({
      formRef: thresholdFormRef,
      submit: payload => saveThresholds(payload),
      successText: t("systemMonitor.thresholdSaved"),
      failType: "error",
      onSuccess: () => {
        fetchThresholds();
        fetchAlerts({ status: alertStatus.value || undefined });
      }
    });
    addDialog({
      title: t("systemMonitor.thresholdSettings"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(ThresholdForm, {
          ref: thresholdFormRef,
          items: thresholds.value?.items ?? []
        }),
      beforeSure
    });
  };

  return { openThresholdDialog };
}
