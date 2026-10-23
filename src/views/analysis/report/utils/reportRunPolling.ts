import { isSuccess } from "@/api/types";
import { exportRecordApi } from "@/api/task/export";
import { message } from "@/utils/message";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

const POLL_INTERVAL = 2000;
const POLL_MAX = 15;

/** 报表「立即运行」后的产物轮询：终态提示并回调刷新列表 */
export async function pollReportRun({
  taskId,
  t,
  onFinished
}: {
  taskId: string;
  t: TFunction;
  onFinished: () => void;
}) {
  for (let attempt = 0; attempt < POLL_MAX; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    const res = await exportRecordApi.retrieve(taskId).catch(() => null);
    if (!res || !isSuccess(res) || !res.data) return;
    const rawStatus = (res.data as { status?: unknown }).status;
    const status =
      rawStatus && typeof rawStatus === "object"
        ? String((rawStatus as { value?: string }).value ?? "")
        : String(rawStatus ?? "");
    if (status === "SUCCESS") {
      message(t("dataReport.runDone"), { type: "success" });
      onFinished();
      return;
    }
    if (status === "FAILURE" || status === "REVOKED") {
      message(
        String(
          (res.data as { error?: string }).error || t("dataReport.runFailed")
        ),
        { type: "error" }
      );
      onFinished();
      return;
    }
  }
  message(t("dataReport.runPollTimeout"), { type: "warning" });
}
