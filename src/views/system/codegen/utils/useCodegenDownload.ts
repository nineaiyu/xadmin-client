import { ref, type Ref } from "vue";
import { downloadByData } from "@pureadmin/utils";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import type { useI18n } from "vue-i18n";
import { systemCodeGenApi } from "@/api/system/codegen";
import type { CodegenPayload } from "@/api/system/codegen";
import type { CodegenFormState } from "./payload";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 代码包下载：单模型 / 批量共用，失败原因供内联错误态展示。 */
export function useCodegenDownload({
  t,
  mode,
  batchModels,
  state,
  payloadSignature,
  baselineSignature,
  buildSinglePayload,
  buildBatchPayload
}: {
  t: TFunction;
  mode: Ref<"single" | "batch">;
  batchModels: Ref<string[]>;
  state: CodegenFormState;
  payloadSignature: Ref<string>;
  baselineSignature: Ref<string>;
  buildSinglePayload: () => CodegenPayload;
  buildBatchPayload: () => CodegenPayload;
}) {
  const downloadLoading = ref(false);
  const downloadError = ref("");

  async function handleDownload() {
    if (mode.value === "batch" && !batchModels.value.length) {
      message(t("codegen.batchPickFirst"), { type: "warning" });
      return;
    }
    if (mode.value === "single" && !state.model) return;
    downloadLoading.value = true;
    downloadError.value = "";
    try {
      const payload =
        mode.value === "batch" ? buildBatchPayload() : buildSinglePayload();
      const res = await systemCodeGenApi.download(payload).catch(error => {
        downloadError.value =
          normalizeError(error).detail || t("results.failed");
        return null;
      });
      if (!res) {
        if (!downloadError.value) downloadError.value = t("results.failed");
        return;
      }
      // 200 + 业务失败（JSON 错误体被当作 blob 下载）不能当成功：
      // 否则会下载一个 .zip 后缀的 JSON 并提示「已开始下载」
      const contentType = String(res.headers?.["content-type"] || "");
      if (contentType.includes("application/json")) {
        let detail = "";
        try {
          const payload = JSON.parse(await (res.data as Blob).text()) as {
            detail?: string;
          };
          detail = String(payload?.detail || "");
        } catch {
          detail = "";
        }
        downloadError.value = detail || t("results.failed");
        return;
      }
      if (!res.data || (res.data as Blob).size === 0) {
        downloadError.value = t("results.failed");
        return;
      }
      const name =
        mode.value === "batch"
          ? "generated-codegen.zip"
          : `generated-${state.model.replace(".", "-")}.zip`;
      downloadByData(res.data, name);
      // 已下载当前配置：后续未改动时离开不再提示
      baselineSignature.value = payloadSignature.value;
      message(t("codegen.downloadStarted"), { type: "success" });
    } finally {
      downloadLoading.value = false;
    }
  }

  return { downloadLoading, downloadError, handleDownload };
}
