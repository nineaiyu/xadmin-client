import { ref } from "vue";
import { copyText } from "@/utils/clipboard";
import type { ApiApplicationCredential } from "@/api/identity/open";

/**
 * 一次性明文密钥展示状态（既定保留手写弹窗）：
 * 状态由本模块维护，由页面模板渲染。回调测试结果由「管理」抽屉的局部
 * state 持有并就地展示，本模块不再重复维护页面级副本。
 */
export function useApiAppCredential() {
  const credentialDialog = ref(false);
  const credential = ref<ApiApplicationCredential | null>(null);

  const openCredential = (data: ApiApplicationCredential) => {
    credential.value = data;
    credentialDialog.value = true;
  };

  /** 关闭即丢弃一次性明文：避免密钥常驻内存、可被再次打开。 */
  const closeCredential = () => {
    credentialDialog.value = false;
    credential.value = null;
  };

  return {
    credentialDialog,
    credential,
    openCredential,
    closeCredential,
    copyText
  };
}
