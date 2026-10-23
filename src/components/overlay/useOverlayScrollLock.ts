import { watch, type Ref } from "vue";
import { getLayoutScrollElement } from "@/utils/dom";
import { useScrollLock } from "@/hooks/useScrollLock";

/**
 * 弹层打开期间锁定布局滚动容器：防止背景滚动穿透，并以滚动条槽位预留
 * （`scrollbar-gutter`）避免关闭后内容横向跳动；独立页（无布局滚动容器）
 * 不重复锁定——EP 内置 lock-scroll 已锁 body，避免双重补偿。
 */
export function useOverlayScrollLock(store: Ref<Array<{ visible?: boolean }>>) {
  const locked = useScrollLock({ immediate: false });
  watch(
    () => store.value.some(options => options.visible),
    visible => {
      if (!getLayoutScrollElement()) return;
      locked.value = visible;
    }
  );
  return locked;
}
