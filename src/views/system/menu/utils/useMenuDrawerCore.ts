import { ref, type Ref } from "vue";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import { buildMenuDrawerOptions } from "./menuDrawerOptions";
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

/**
 * 菜单抽屉核心状态机（自 useMenuDrawer 抽出）：打开态 / 脏检查 / 关闭 /
 * 未保存拦截 / 打开（三种打开动作共用同一抽屉壳）。
 */
export function useMenuDrawerCore({
  t,
  auth,
  treeData,
  choicesDict,
  modelList,
  viewList,
  menuUrlList,
  submit
}: {
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
}) {
  const formRef = ref();
  const current = ref<{ pk?: number | string; isAdd: boolean } | null>(null);
  let options: DrawerOptions | null = null;

  const isOpen = () => Boolean(current.value);
  const openPk = () => current.value?.pk;
  const dirty = () => Boolean(formRef.value?.isDirty?.());

  /** 清理打开态（正常关闭、外部关闭与保存成功三条路径共用） */
  const clearState = () => {
    options = null;
    current.value = null;
    formRef.value = undefined;
  };

  const close = () => {
    if (options) closeDrawer(options, 0, { command: "close" });
    clearState();
  };

  /** 关闭前拦截未保存变更（见 menuDrawerSwitch.createUnsavedGuard） */
  const guard = createUnsavedGuard({ t, dirty });

  const open = (
    model: MenuFormModel,
    isAdd: boolean,
    title: string,
    pk?: number | string
  ) => {
    // 切换节点/连续新增时避免抽屉叠层：先收起上一个
    if (current.value && options) close();
    current.value = { pk, isAdd };
    const drawer = buildMenuDrawerOptions({
      title,
      model,
      isAdd,
      auth,
      formRef,
      treeData,
      choicesDict,
      modelList,
      viewList,
      menuUrlList,
      guard,
      submit,
      onSuccess: clearState,
      onClosed: clearState
    });
    options = drawer;
    addDrawer(drawer);
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
