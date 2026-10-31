import { ref, type Ref } from "vue";
import {
  addDrawer,
  closeDrawer,
  drawerStore,
  updateDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import {
  buildMenuDrawerOptions,
  type MenuDrawerState
} from "./menuDrawerOptions";
import { createUnsavedGuard } from "./menuDrawerSwitch";
import type { useI18n } from "vue-i18n";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuFormModel,
  MenuRow,
  MenuUrlItem,
  ModelTreeItem
} from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

/** EP 抽屉离场过渡 + 余量：上一层还在动画时把新层延后入队，避免瞬间双弹层 */
const SWITCH_SETTLE_MS = 320;

export interface MenuDrawerSessionDeps {
  t: TFunction;
  auth: MenuAuths;
  treeData: Ref<MenuRow[]>;
  choicesDict: Ref<Record<string, MenuChoiceItem[]>>;
  modelList: Ref<ModelTreeItem[]>;
  viewList: Ref<Record<string, string>>;
  menuUrlList: Ref<MenuUrlItem[]>;
  submit: (
    payload: MenuFormModel,
    isAdd: boolean,
    cascadePks: Array<number | string>
  ) => Promise<boolean>;
}

/**
 * 菜单抽屉队列会话：打开 / 复用 / 关闭 / 清理。
 *
 * 同一时间只允许存在一个可见抽屉：
 * - 已有可见实例 → 复用该实例（只换标题与内容，内容按 `seq` 重挂载表单）；
 * - 上一实例仍在离场动画 → 新实例延后入队，等它出栈后再入，避免两层同时可见。
 */
export function createMenuDrawerSession({
  t,
  auth,
  treeData,
  choicesDict,
  modelList,
  viewList,
  menuUrlList,
  submit
}: MenuDrawerSessionDeps) {
  const formRef = ref();
  const current = ref<{ pk?: number | string; isAdd: boolean } | null>(null);
  let drawerState: Ref<MenuDrawerState | null> = ref(null);
  let options: DrawerOptions | null = null;
  let openSeq = 0;
  /** 清理令牌：旧实例的关闭回调不得清掉新实例的打开态 */
  let clearToken = 0;

  const isOpen = () => Boolean(current.value);
  const openPk = () => current.value?.pk;
  const dirty = () => Boolean(formRef.value?.isDirty?.());

  /** 清理打开态（保存成功与关闭动画结束两条路径共用） */
  const clearState = (token?: number) => {
    if (token !== undefined && token !== clearToken) return;
    options = null;
    current.value = null;
    formRef.value = undefined;
  };

  const close = () => {
    if (options) closeDrawer(options, 0, { command: "close" });
    // 立即结束打开态（isOpen / dirty 不再报告关闭中的节点），
    // options 留给下一次 open 判定「仍在离场」，清理由 @closed 的 onClosed 收尾
    current.value = null;
    formRef.value = undefined;
  };

  /** 关闭前拦截未保存变更（见 menuDrawerSwitch.createUnsavedGuard） */
  const guard = createUnsavedGuard({ t, dirty });

  /** 新建一层抽屉；旧层仍在离场时延后入队 */
  function mount(next: MenuDrawerState) {
    const token = ++clearToken;
    drawerState = ref(next);
    const built = buildMenuDrawerOptions({
      state: drawerState,
      auth,
      formRef,
      treeData,
      choicesDict,
      modelList,
      viewList,
      menuUrlList,
      guard,
      submit,
      onSuccess: () => clearState(token),
      onClosed: () => clearState(token)
    });
    const closing = drawerStore.value.some(item => item.visible === false);
    options = closing ? { ...built, openDelay: SWITCH_SETTLE_MS } : built;
    addDrawer(options);
  }

  const open = (
    model: MenuFormModel,
    isAdd: boolean,
    title: string,
    pk?: number | string
  ) => {
    const next: MenuDrawerState = { title, model, isAdd, pk, seq: ++openSeq };
    current.value = { pk, isAdd };
    // 复用已有可见实例：不新增队列条目，标题经响应式选项代理更新
    if (
      options &&
      options.visible === true &&
      drawerStore.value.includes(options)
    ) {
      drawerState.value = next;
      updateDrawer(title, "title", options);
      return;
    }
    mount(next);
  };

  return {
    formRef,
    current,
    isOpen,
    openPk,
    dirty,
    clearState,
    close,
    guard,
    open
  };
}
