import { onBeforeUnmount, onMounted, type Ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { useI18n } from "vue-i18n";
import { useConfirm } from "@/hooks/useConfirm";

/**
 * 设计器未保存守卫（报表 / 大屏 / 表单设计器共用）。
 *
 * - `mode: "page"`（默认）：关闭 / 刷新标签页走浏览器原生确认，站内路由离开走
 *   应用内确认弹窗；
 * - `mode: "dialog"`：不注册路由/刷新监听，只返回 `confirmLeave()` 供弹窗
 *   `beforeClose` 复用同一套文案与交互。
 *
 * 文案取自 `${namespace}.leaveConfirm / .leave / .stay`，各设计器在 locales 中
 * 维护自己的命名空间，避免共用一套措辞。
 */
export function useDesignerGuard({
  dirty,
  namespace,
  mode = "page"
}: {
  dirty: Ref<boolean>;
  namespace: string;
  mode?: "page" | "dialog";
}) {
  const { t } = useI18n();
  const confirm = useConfirm();

  const confirmLeave = () =>
    confirm(t(`${namespace}.leaveConfirm`), {
      title: t(`${namespace}.unsaved`),
      confirmButtonText: t(`${namespace}.leave`),
      cancelButtonText: t(`${namespace}.stay`)
    });

  if (mode === "page") {
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
      return confirmLeave();
    });
  }

  return { confirmLeave };
}
