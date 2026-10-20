import { onBeforeUnmount, onMounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { useConfirm } from "@/hooks/useConfirm";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 设计器未保存守卫（自 designer 抽出，行数门禁）：
 * - 关闭 / 刷新标签页：浏览器原生二次确认（`beforeunload`）；
 * - 站内路由离开：应用内确认弹窗（与历史手写行为一致）。
 */
export function useUnsavedGuard({
  dirty,
  t
}: {
  dirty: Ref<boolean>;
  t: TFunction;
}) {
  const confirm = useConfirm();

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty.value) return;
    event.preventDefault();
    event.returnValue = "";
  };

  onMounted(() => window.addEventListener("beforeunload", onBeforeUnload));
  onBeforeUnmount(() =>
    window.removeEventListener("beforeunload", onBeforeUnload)
  );

  onBeforeRouteLeave(async () => {
    if (!dirty.value) return true;
    return confirm(t("dataScreen.leaveConfirm"), {
      title: t("dataScreen.unsaved"),
      confirmButtonText: t("dataScreen.leave"),
      cancelButtonText: t("dataScreen.stay")
    });
  });
}
