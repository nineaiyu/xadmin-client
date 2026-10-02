import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type {
  ApiApplicationCredential,
  CallbackProbeResult
} from "@/api/system/open";

/**
 * 一次性明文密钥展示状态与剪贴板（C5 既定保留手写弹窗）：
 * 状态由本模块维护，由页面模板渲染；probeResults 汇总最近一次回调测试结果。
 */
export function useApiAppCredential() {
  const { t } = useI18n();
  const credentialDialog = ref(false);
  const credential = ref<ApiApplicationCredential | null>(null);
  const probeResults = ref<CallbackProbeResult[]>([]);

  const openCredential = (data: ApiApplicationCredential) => {
    credential.value = data;
    credentialDialog.value = true;
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message(t("apiApp.copied"), { type: "success" });
    } catch {
      message(t("apiApp.copyFailed"), { type: "warning" });
    }
  };

  return {
    credentialDialog,
    credential,
    probeResults,
    openCredential,
    copyText
  };
}
