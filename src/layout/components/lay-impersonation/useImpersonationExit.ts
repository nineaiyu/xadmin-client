import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { message } from "@/utils/message";

/**
 * 退出用户模拟的共享交互（顶栏横幅与头像下拉菜单共用）：
 * 防重复点击 + 失败可读提示，成功后由 store 整页刷新恢复原身份。
 */
export function useImpersonationExit() {
  const { t } = useI18n();
  const userStore = useUserStoreHook();
  const exiting = ref(false);

  async function exitImpersonation() {
    if (exiting.value) return;
    exiting.value = true;
    try {
      await userStore.exitImpersonation();
    } catch (error) {
      exiting.value = false;
      const detail = (error as { detail?: string })?.detail;
      message(detail || t("layout.impersonateExitFailed"), { type: "error" });
    }
  }

  return { exiting, exitImpersonation };
}
