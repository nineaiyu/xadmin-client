import { ref, type Ref } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import { isFunction } from "@pureadmin/utils";
import type { OverlayArgs, OverlayBaseOptions } from "./types";

/** 弹层内部挂载的不可枚举唯一标识 */
type WithUid = { _uid?: number };

export interface OverlayPayloadApi<T> {
  getData: () => T;
  setData: (data: T | ((prev: T) => T)) => void;
}

/**
 * 弹层队列工厂：ReDialog / ReDrawer 共用同一套「入队、uid、延迟、载荷通道、
 * 关闭清理」语义，组件只保留各自的 Element Plus 模板差异。
 *
 * `_uid` 与载荷通道三个字段一律挂为**不可枚举**：模板 `v-bind="options"` 会把
 * 可枚举字段透传给 `el-dialog` / `el-drawer`，函数/对象值会被字符串化落到 DOM。
 */
export function createOverlayStore<
  TOptions extends OverlayBaseOptions<TOptions>
>() {
  const store = ref<TOptions[]>([]) as Ref<TOptions[]>;
  let uid = 0;

  const getUid = (options: TOptions): number | undefined =>
    (options as TOptions & WithUid)?._uid;

  function attachPayloadChannel<T>(
    options: TOptions & { payload: T }
  ): OverlayPayloadApi<T> {
    const initial = options.payload as T;
    const state = ref(initial) as Ref<T>;
    const api: OverlayPayloadApi<T> = {
      getData: () => state.value,
      setData: data => {
        state.value = isFunction(data)
          ? (data as (prev: T) => T)(state.value)
          : (data as T);
      }
    };
    const fields = [
      ["payload", initial],
      ["getData", api.getData],
      ["setData", api.setData]
    ] as const;
    for (const [key, value] of fields) {
      Object.defineProperty(options, key, {
        value,
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
    return api;
  }

  /**
   * 打开弹层。传入 `payload` 时启用类型化载荷通道并返回读写 API
   * （内容组件经 props 同名接收 `getData/setData`；未传 `payload` 时返回 `void`）。
   */
  function add<T>(options: TOptions & { payload: T }): OverlayPayloadApi<T>;
  function add(options: TOptions): void;
  function add(options: TOptions) {
    const channel =
      options.payload === undefined
        ? undefined
        : attachPayloadChannel(options as TOptions & { payload: unknown });
    const open = () => {
      Object.defineProperty(options, "_uid", {
        value: ++uid,
        enumerable: false,
        configurable: true,
        writable: true
      });
      store.value.push(Object.assign(options, { visible: true }) as TOptions);
    };
    if (options.openDelay) {
      useTimeoutFn(open, options.openDelay);
    } else {
      open();
    }
    return channel;
  }

  /** 关闭弹层：按 options 引用重新定位，避免延迟关闭期间下标漂移。 */
  const close = (options: TOptions, index: number, args?: OverlayArgs) => {
    const byRef = store.value.indexOf(options);
    const targetIndex = byRef > -1 ? byRef : index;
    const target = store.value[targetIndex];
    if (!target) return;
    target.visible = false;
    options.closeCallBack?.({ options, index: targetIndex, args });

    const closeDelay = options.closeDelay ?? 200;
    useTimeoutFn(() => {
      const currentIndex = store.value.indexOf(options);
      if (currentIndex > -1) store.value.splice(currentIndex, 1);
    }, closeDelay);
  };

  const update = <K extends keyof TOptions>(
    value: TOptions[K],
    key: K,
    index = 0
  ) => {
    store.value[index][key] = value;
  };

  const closeAll = () => {
    store.value = [];
  };

  return { store, getUid, add, close, update, closeAll };
}
