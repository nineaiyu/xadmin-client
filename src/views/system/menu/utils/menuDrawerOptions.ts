import { h } from "vue";
import MenuDrawerForm from "../components/MenuDrawerForm.vue";
import type { DrawerOptions } from "@/components/ReDrawer";
import type { Ref } from "vue";
import { drawerSize } from "@/components/ReDialog/size";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuFormModel,
  MenuRow,
  MenuUrlItem,
  ModelTreeItem
} from "./types";

/** 抽屉打开态快照：复用同一实例切换节点时按引用更新（`seq` 用于表单重挂载） */
export interface MenuDrawerState {
  title: string;
  model: MenuFormModel;
  isAdd: boolean;
  pk?: number | string;
  seq: number;
}

/** 菜单抽屉构建上下文（状态归 useMenuDrawerCore，本模块只组装抽屉配置） */
export type MenuDrawerOptionContext = {
  state: Ref<MenuDrawerState | null>;
  auth: MenuAuths;
  formRef: Ref;
  treeData: Ref<MenuRow[]>;
  choicesDict: Ref<Record<string, MenuChoiceItem[]>>;
  modelList: Ref<ModelTreeItem[]>;
  viewList: Ref<Record<string, string>>;
  menuUrlList: Ref<MenuUrlItem[]>;
  /** 关闭前拦截未保存变更 */
  guard: (done: () => void) => void;
  /** 提交保存（返回成功与否） */
  submit: (
    payload: MenuFormModel,
    isAdd: boolean,
    cascadePks: Array<number | string>
  ) => Promise<boolean>;
  /** 保存成功：清理打开态（options / current / formRef） */
  onSuccess: () => void;
  /** 经右上角/ESC/遮罩关闭：清理打开态（避免脏检查误判为"仍在编辑"） */
  onClosed: () => void;
};

/** 菜单新增/编辑抽屉配置（自 useMenuDrawer 抽出，控制单文件行数） */
export function buildMenuDrawerOptions(
  ctx: MenuDrawerOptionContext
): DrawerOptions {
  const {
    state,
    auth,
    formRef,
    treeData,
    choicesDict,
    modelList,
    viewList,
    menuUrlList,
    guard,
    submit,
    onSuccess,
    onClosed
  } = ctx;

  return {
    title: state.value?.title ?? "",
    size: drawerSize("md"),
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    // 非模态 + 可穿透遮罩：树与工具栏保持可交互（切换节点由脏检查把关），
    // 也避免"抽屉打开时无法再点工具栏"
    modal: false,
    modalPenetrable: true,
    lockScroll: false,
    contentRenderer: () => {
      const current = state.value;
      if (!current) return h("div");
      return h(MenuDrawerForm, {
        // 复用同一抽屉实例切换节点：换 key 让表单按新模型重新初始化，
        // 否则表单只在 setup 时读一次 props.model（会残留上一个节点）
        key: `menu-form-${current.seq}`,
        ref: formRef,
        model: current.model,
        isAdd: current.isAdd,
        auth,
        treeData: treeData.value,
        choicesDict: choicesDict.value,
        modelList: modelList.value,
        viewList: viewList.value,
        menuUrlList: menuUrlList.value
      });
    },
    beforeSure: (done, { closeLoading }) => {
      const form = formRef.value;
      const current = state.value;
      if (!current) {
        closeLoading();
        return;
      }
      form
        ?.validate?.()
        .then(async (valid: boolean) => {
          if (!valid) {
            closeLoading();
            return;
          }
          const payload = form.getPayload() as MenuFormModel;
          const cascade = (form.getCascadePks?.() ?? []) as Array<
            number | string
          >;
          const ok = await submit(payload, current.isAdd, cascade);
          if (ok) {
            onSuccess();
            done();
          }
          closeLoading();
        })
        .catch(() => closeLoading());
    },
    beforeCancel: guard,
    beforeClose: guard,
    closeCallBack: ({ args }) => {
      if (args?.command !== "sure") onClosed();
    }
  };
}
