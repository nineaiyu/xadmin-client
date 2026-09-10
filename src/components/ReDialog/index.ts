import { ref } from "vue";
import reDialog from "./index.vue";
import { useTimeoutFn } from "@vueuse/core";
import { withInstall } from "@pureadmin/utils";
import type {
  EventType,
  ArgsType,
  DialogProps,
  ButtonProps,
  DialogOptions
} from "./type";

/** 兼容扩展：弹层内部挂载的不可枚举唯一标识 */
type DialogOptionsWithUid = DialogOptions & { _uid?: number };

const dialogStore = ref<Array<DialogOptions>>([]);

/** 弹层实例自增标识（挂载为不可枚举属性，避免经 `v-bind="options"` 透传给 el-dialog） */
let dialogUid = 0;

/** 读取弹层唯一标识：用作稳定 `key` 与按钮状态映射，替代易失效的数组下标 */
export const getDialogUid = (options: DialogOptions): number | undefined =>
  (options as DialogOptionsWithUid)?._uid;

/** 打开弹框 */
const addDialog = (options: DialogOptions) => {
  const open = () => {
    Object.defineProperty(options, "_uid", {
      value: ++dialogUid,
      enumerable: false,
      configurable: true,
      writable: true
    });
    dialogStore.value.push(Object.assign(options, { visible: true }));
  };
  if (options?.openDelay) {
    useTimeoutFn(() => {
      open();
    }, options.openDelay);
  } else {
    open();
  }
};

/** 关闭弹框 */
const closeDialog = (
  options: DialogOptions,
  index: number,
  args?: ArgsType
) => {
  // 下标由模板实时传入，但延迟关闭期间若有其它弹层被移除，下标会失效；
  // 统一按 options 引用在 store 中重新定位，失败再回退传入下标。
  const byRef = dialogStore.value.indexOf(options);
  const targetIndex = byRef > -1 ? byRef : index;
  const target = dialogStore.value[targetIndex];
  if (!target) return;
  target.visible = false;
  if (options.closeCallBack) {
    options.closeCallBack({ options, index: targetIndex, args });
  }

  const closeDelay = options?.closeDelay ?? 200;
  useTimeoutFn(() => {
    // 延迟回调内再次定位：期间数组可能已被其它弹层关闭操作改动
    const currentIndex = dialogStore.value.indexOf(options);
    if (currentIndex > -1) dialogStore.value.splice(currentIndex, 1);
  }, closeDelay);
};

/**
 * @description 更改弹框自身属性值
 * @param value 属性值
 * @param key 弹框属性名
 * @param index 弹框索引（默认`0`，代表只有一个弹框，对于嵌套弹框要改哪个弹框的属性值就把该弹框索引赋给`index`）
 */
const updateDialog = <K extends keyof DialogOptions>(
  value: DialogOptions[K],
  key: K,
  index = 0
) => {
  dialogStore.value[index][key] = value;
};

/** 关闭所有弹框 */
const closeAllDialog = () => {
  dialogStore.value = [];
};

/** 千万别忘了在下面这三处引入并注册下，放心注册，不使用`addDialog`调用就不会被挂载
 * https://github.com/pure-admin/vue-pure-admin/blob/main/src/App.vue#L4
 * https://github.com/pure-admin/vue-pure-admin/blob/main/src/App.vue#L12
 * https://github.com/pure-admin/vue-pure-admin/blob/main/src/App.vue#L22
 */
const ReDialog = withInstall(reDialog);

export type { EventType, ArgsType, DialogProps, ButtonProps, DialogOptions };
export {
  ReDialog,
  dialogStore,
  addDialog,
  closeDialog,
  updateDialog,
  closeAllDialog
};
