import { watch, type Ref } from "vue";
import { getLayoutScrollElement } from "@/utils/dom";
import { useScrollLock } from "@/hooks/useScrollLock";

/** 弹层可见性来源：命令式弹层队列，或声明式弹层的布尔/布尔函数。 */
export type OverlayVisibilitySource =
  Ref<Array<{ visible?: boolean }>> | (() => boolean);

/**
 * 弹层打开期间锁定布局滚动容器：防止背景滚动穿透，并以滚动条槽位预留
 * （`scrollbar-gutter`）避免关闭后内容横向跳动；独立页（无布局滚动容器）
 * 不重复锁定——EP 内置 lock-scroll 已锁 body，避免双重补偿。
 *
 * 命令式弹层传 store 队列，声明式弹层传可见性函数（OverlayDialog / OverlayDrawer），
 * 两种形态共用同一套锁定语义。
 */
export function useOverlayScrollLock(source: OverlayVisibilitySource) {
  const locked = useScrollLock({ immediate: false });
  const visible = () =>
    typeof source === "function"
      ? source()
      : source.value.some(options => options.visible);
  watch(
    visible,
    next => {
      if (!getLayoutScrollElement()) return;
      locked.value = next;
    },
    { immediate: true }
  );
  return locked;
}
