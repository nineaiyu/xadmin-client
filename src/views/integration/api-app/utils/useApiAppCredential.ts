import { ref } from "vue";
import { copyText } from "@/utils/clipboard";
import type {
  ApiApplicationCredential,
  CallbackProbeResult
} from "@/api/system/open";

/**
 * 一次性明文密钥展示状态（C5 既定保留手写弹窗）：
 * 状态由本模块维护，由页面模板渲染；probeResults 汇总最近一次回调测试结果。
 */
export function useApiAppCredential() {
  const credentialDialog = ref(false);
  const credential = ref<ApiApplicationCredential | null>(null);
  const probeResults = ref<CallbackProbeResult[]>([]);

  const openCredential = (data: ApiApplicationCredential) => {
    credential.value = data;
    credentialDialog.value = true;
  };

  return {
    credentialDialog,
    credential,
    probeResults,
    openCredential,
    copyText
  };
}
