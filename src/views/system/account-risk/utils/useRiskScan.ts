import { onUnmounted, ref } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { accountRiskApi } from "@/api/system/security";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";

type TFunction = ReturnType<typeof useI18n>["t"];

const POLL_INTERVAL = 1000;
const MAX_POLL_MS = 10 * 60 * 1000;

/**
 * 异步巡检（P2-112）：投递后轮询 scan-status，页面显示 progress/stage；
 * 终态刷新列表与统计。同步接口时代的长耗时请求不再阻塞浏览器。
 */
export function useRiskScan({
  t,
  api,
  tableRef,
  refreshStats
}: {
  t: TFunction;
  api: Pick<typeof accountRiskApi, "scan" | "scanStatus">;
  tableRef: Ref;
  refreshStats: () => void;
}) {
  const scanning = ref(false);
  const progress = ref(0);
  const stage = ref("");
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deadline = 0;
  let disposed = false;

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const finish = (loading?: { value: boolean }) => {
    scanning.value = false;
    stop();
    if (loading) loading.value = false;
  };

  const poll = async (taskId: string, loading?: { value: boolean }) => {
    if (disposed) return;
    if (Date.now() > deadline) {
      finish(loading);
      message(t("accountRisk.scanTimeout"), { type: "warning" });
      return;
    }
    const res = await api.scanStatus(taskId).catch(normalizeError);
    if (!isSuccess(res) || !res.data) {
      finish(loading);
      message(String(res.detail || t("accountRisk.scanStatusFailed")), {
        type: "error"
      });
      return;
    }
    progress.value = res.data.progress;
    stage.value = res.data.stage;
    if (res.data.status === "SUCCESS") {
      progress.value = 100;
      finish(loading);
      tableRef.value?.handleGetData?.();
      refreshStats();
      message(
        t("accountRisk.scanDone", {
          total: res.data.result?.total ?? 0
        }),
        { type: "success" }
      );
      return;
    }
    if (["FAILURE", "REVOKED"].includes(res.data.status)) {
      finish(loading);
      message(res.data.error || t("accountRisk.scanFailed"), { type: "error" });
      return;
    }
    timer = setTimeout(() => void poll(taskId, loading), POLL_INTERVAL);
  };

  const scan = async (loading?: { value: boolean }) => {
    if (scanning.value) return;
    scanning.value = true;
    progress.value = 0;
    stage.value = "";
    deadline = Date.now() + MAX_POLL_MS;
    if (loading) loading.value = true;
    const res = await api.scan().catch(normalizeError);
    if (!isSuccess(res) || !res.data?.task_id) {
      finish(loading);
      message(String(res.detail || t("accountRisk.scanFailed")), {
        type: "error"
      });
      return;
    }
    void poll(res.data.task_id, loading);
  };

  onUnmounted(() => {
    disposed = true;
    stop();
  });

  return { scan, scanning, progress, stage };
}
