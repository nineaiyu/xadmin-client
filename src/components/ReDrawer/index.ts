import { ref, type Ref } from "vue";
import reDrawer from "./index.vue";
import { useTimeoutFn } from "@vueuse/core";
import { isFunction, withInstall } from "@pureadmin/utils";
import type {
  EventType,
  ArgsType,
  DrawerProps,
  DrawerOptions,
  DrawerPayloadApi,
  ButtonProps
} from "./type";

/** 兼容扩展：抽屉内部挂载的不可枚举唯一标识 */
type DrawerOptionsWithUid = DrawerOptions & { _uid?: number };

const drawerStore = ref<Array<DrawerOptions>>([]);

/** 抽屉实例自增标识（挂载为不可枚举属性，避免经 `v-bind="options"` 透传给 el-drawer） */
let drawerUid = 0;

/** 读取抽屉唯一标识：用作稳定 `key` 与按钮状态映射，替代易失效的数组下标 */
export const getDrawerUid = (options: DrawerOptions): number | undefined =>
  (options as DrawerOptionsWithUid)?._uid;

/**
 * 创建类型化载荷通道：`ref` 作单一数据源，`getData/setData` 读写同一份，
 * 同时挂到选项上（受控数据随抽屉条目走，内容组件经 props 同名接收）。
 *
 * 三个字段一律挂为**不可枚举**：模板 `v-bind="options"` 会把可枚举字段透传给
 * `el-drawer`，函数/对象值会被字符串化落到 DOM（同 `_uid` 的既有手段）。
 */
function attachPayloadChannel<T>(
  options: DrawerOptions<T>
): DrawerPayloadApi<T> {
  const initial = options.payload as T;
  const state = ref(initial) as Ref<T>;
  const api: DrawerPayloadApi<T> = {
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
 * 打开抽屉。传入 `payload` 时启用类型化载荷通道并返回读写 API
 * （内容组件经 props 同名接收 `getData/setData`；未传 `payload` 时行为不变、返回 `void`）。
 */
function addDrawer<T>(
  options: DrawerOptions<T> & { payload: T }
): DrawerPayloadApi<T>;
function addDrawer(options: DrawerOptions): void;
function addDrawer(options: DrawerOptions) {
  const channel =
    options.payload === undefined ? undefined : attachPayloadChannel(options);
  const open = () => {
    Object.defineProperty(options, "_uid", {
      value: ++drawerUid,
      enumerable: false,
      configurable: true,
      writable: true
    });
    drawerStore.value.push(Object.assign(options, { visible: true }));
  };
  if (options?.openDelay) {
    useTimeoutFn(() => {
      open();
    }, options.openDelay);
  } else {
    open();
  }
  return channel;
}

/** 关闭抽屉 */
const closeDrawer = (
  options: DrawerOptions,
  index: number,
  args?: ArgsType
) => {
  // 下标由模板实时传入，但延迟关闭期间若有其它抽屉被移除，下标会失效；
  // 统一按 options 引用在 store 中重新定位，失败再回退传入下标。
  const byRef = drawerStore.value.indexOf(options);
  const targetIndex = byRef > -1 ? byRef : index;
  const target = drawerStore.value[targetIndex];
  if (!target) return;
  target.visible = false;
  if (options.closeCallBack) {
    options.closeCallBack({ options, index: targetIndex, args });
  }
  const closeDelay = options?.closeDelay ?? 200;
  useTimeoutFn(() => {
    // 延迟回调内再次定位：期间数组可能已被其它抽屉关闭操作改动
    const currentIndex = drawerStore.value.indexOf(options);
    if (currentIndex > -1) drawerStore.value.splice(currentIndex, 1);
  }, closeDelay);
};

/**
 * @description 更改抽屉自身属性值
 * @param value 属性值
 * @param key 抽屉属性名
 * @param index 弹框索引（默认`0`，代表只有一个弹框，对于嵌套弹框要改哪个弹框的属性值就把该弹框索引赋给`index`）
 */
const updateDrawer = <K extends keyof DrawerOptions>(
  value: DrawerOptions[K],
  key: K,
  index = 0
) => {
  drawerStore.value[index][key] = value;
};

/** 关闭所有弹框 */
const closeAllDrawer = () => {
  drawerStore.value = [];
};

const ReDrawer = withInstall(reDrawer);

export type {
  EventType,
  ArgsType,
  DrawerOptions,
  DrawerPayloadApi,
  DrawerProps,
  ButtonProps
};
export {
  ReDrawer,
  drawerStore,
  addDrawer,
  closeDrawer,
  updateDrawer,
  closeAllDrawer
};
