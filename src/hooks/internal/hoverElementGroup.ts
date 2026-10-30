import type { MaybeRef, Ref } from "vue";

import { computed, effectScope, ref, unref, watch } from "vue";
import { useElementHover } from "@vueuse/core";

/** 可监测元素：原生元素或其组件实例（读取 `$el`） */
export type HoverTarget = HTMLElement | { $el?: Element } | null | undefined;

function resolveElement(target: HoverTarget): HTMLElement | null {
  const el = unref(target);
  if (!el) return null;
  return el instanceof Element
    ? (el as HTMLElement)
    : ((el.$el as HTMLElement | undefined) ?? null);
}

/**
 * 元素组悬停监测：为每个目标建立独立响应式作用域（`effectScope`），元素数量
 * 变化时重建；`hovers` 是各元素悬停态的 ref 列表。`dispose` 清理监听与作用域。
 */
export function createHoverElementGroup(
  refElement: MaybeRef<HoverTarget | HoverTarget[]>
) {
  let scopes: ReturnType<typeof effectScope>[] = [];
  const hovers = ref<Ref<boolean>[]>([]);

  const elements = computed<HoverTarget[]>(() => {
    const raw = unref(refElement);
    if (raw === null || raw === undefined) return [];
    return Array.isArray(raw) ? raw : [raw];
  });

  function rebuild() {
    scopes.forEach(scope => scope.stop());
    scopes = [];
    hovers.value = elements.value.map(target => {
      if (!target) return ref(false);
      const elRef = computed<HTMLElement | null>(() => resolveElement(target));
      const scope = effectScope();
      const hoverRef = scope.run(() => useElementHover(elRef)) ?? ref(false);
      scopes.push(scope);
      return hoverRef;
    });
  }
  rebuild();

  const stopWatcher = watch(
    computed(() => elements.value.length),
    rebuild
  );

  function dispose() {
    stopWatcher();
    scopes.forEach(scope => scope.stop());
    scopes = [];
  }

  return { hovers, dispose };
}
