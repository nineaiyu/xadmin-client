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
  /** 已触发过 closeCallBack 的条目：关闭动画结束时 EP 会再次进入关闭路径 */
  const notified = new WeakSet<TOptions>();

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

  /**
   * 关闭弹层：按 options 引用重新定位，避免延迟关闭期间下标漂移。
   *
   * 只负责隐藏 + 回调（去重），**不做延时出队**：出队由 `finalize` 在
   * Element Plus 的 `@closed` 上执行，保证离场过渡完整、不出现卸载跳变。
   */
  const close = (options: TOptions, index: number, args?: OverlayArgs) => {
    const byRef = store.value.indexOf(options);
    const targetIndex = byRef > -1 ? byRef : index;
    const target = store.value[targetIndex];
    if (!target) return;
    target.visible = false;
    if (!notified.has(options)) {
      notified.add(options);
      options.closeCallBack?.({ options, index: targetIndex, args });
    }
  };

  /** 关闭动画结束（EP `@closed`）：出队并复位关闭去重标记 */
  const finalize = (options: TOptions) => {
    const currentIndex = store.value.indexOf(options);
    if (currentIndex > -1) store.value.splice(currentIndex, 1);
    notified.delete(options);
  };

  /**
   * 更新目标定位：优先 options 引用，其次实例 uid，最后才用下标兜底。
   * 关闭动画窗口内下标记账会漂移，按下标直接改属性会改到别的弹层。
   */
  function resolveTarget(
    target: number | TOptions | undefined
  ): TOptions | undefined {
    if (target === undefined) return store.value[0];
    if (typeof target !== "number") {
      const byRef = store.value.indexOf(target);
      if (byRef > -1) return store.value[byRef];
      const id = getUid(target);
      return id === undefined
        ? undefined
        : store.value.find(item => getUid(item) === id);
    }
    return store.value[target];
  }

  const update = <K extends keyof TOptions>(
    value: TOptions[K],
    key: K,
    target: number | TOptions = 0
  ) => {
    const options = resolveTarget(target);
    // 目标已出队（或尚未入队）时静默跳过：调用方无需感知队列时序
    if (!options) return;
    options[key] = value;
  };

  const closeAll = () => {
    store.value = [];
  };

  return { store, getUid, add, close, finalize, update, closeAll };
}
