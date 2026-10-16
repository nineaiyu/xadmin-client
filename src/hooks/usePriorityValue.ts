import type { ComputedRef, Ref } from "vue";

import { computed, getCurrentInstance, unref, useAttrs, useSlots } from "vue";
import { getFirstNonNullOrUndefined } from "@/utils/inference";
import { kebabToCamelCase } from "@/utils/letter";

/**
 * 按「插槽 → attrs → props → state」的优先级取值。
 *
 * props 恒有默认值，会污染优先级判断，故先看 `instance.vnode.props`（仅记录
 * 调用方真实传入的键，且为 kebab 形态）是否出现该键，未出现则视为 props 未传。
 * 插槽值本身是渲染函数，非空即代表调用方提供了该 slot。
 */
export function usePriorityValue<T extends object, K extends keyof T>(
  key: K,
  props: T,
  state?: Readonly<Ref<Record<string, unknown>>> | undefined
): ComputedRef<T[K]> {
  const instance = getCurrentInstance();
  const slots = useSlots();
  const attrs = useAttrs();

  return computed((): T[K] => {
    const rawProps = (instance?.vnode?.props ?? {}) as Record<string, unknown>;
    const rawKeys = new Set(
      Object.keys(rawProps).map(item => kebabToCamelCase(item))
    );
    const passedByProps = rawKeys.has(key as string);

    const resolved = getFirstNonNullOrUndefined<unknown>(
      slots[key as string],
      attrs[key as string],
      passedByProps ? props[key] : undefined,
      state?.value?.[key as string]
    );
    return resolved as T[K];
  });
}

/** 批量取值：每个键都是一个 `ComputedRef`。 */
export function usePriorityValues<T extends object>(
  props: T,
  state?: Readonly<Ref<Record<string, unknown>>> | undefined
): { [K in keyof T]: ComputedRef<T[K]> } {
  const result = {} as { [K in keyof T]: ComputedRef<T[K]> };
  (Object.keys(props) as (keyof T)[]).forEach(key => {
    result[key] = usePriorityValue(key, props, state);
  });
  return result;
}

/**
 * 批量取值并收敛为单个 computed，
 * 便于 `v-bind="forward"` 整体透传给子组件。
 */
export function useForwardPriorityValues<T extends object>(
  props: T,
  state?: Readonly<Ref<Record<string, unknown>>> | undefined
): ComputedRef<{ [K in keyof T]: T[K] }> {
  const priority = usePriorityValues(props, state);
  return computed(() => {
    const unwrapped = {} as { [K in keyof T]: T[K] };
    (Object.keys(props) as (keyof T)[]).forEach(key => {
      unwrapped[key] = unref(priority[key]);
    });
    return unwrapped;
  });
}
