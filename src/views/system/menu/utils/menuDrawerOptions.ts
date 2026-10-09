import { h } from "vue";
import MenuDrawerForm from "../components/MenuDrawerForm.vue";
import type { DrawerOptions } from "@/components/ReDrawer";
import type { Ref } from "vue";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuFormModel,
  MenuRow,
  MenuUrlItem,
  ModelTreeItem
} from "./types";

/** 菜单抽屉构建上下文（状态归 useMenuDrawerCore，本模块只组装抽屉配置） */
export type MenuDrawerOptionContext = {
  title: string;
  model: MenuFormModel;
  isAdd: boolean;
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
    onSuccess,
    onClosed
  } = ctx;

  return {
    title,
    size: "620px",
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    // 非模态 + 可穿透遮罩：树与工具栏保持可交互（切换节点由脏检查把关），
    // 也避免"抽屉打开时无法再点工具栏"
    modal: false,
    modalPenetrable: true,
    lockScroll: false,
    contentRenderer: () =>
      h(MenuDrawerForm, {
        ref: formRef,
        model,
        isAdd,
        auth,
        treeData: treeData.value,
        choicesDict: choicesDict.value,
        modelList: modelList.value,
        viewList: viewList.value,
        menuUrlList: menuUrlList.value
      }),
    beforeSure: (done, { closeLoading }) => {
      const form = formRef.value;
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
          const ok = await submit(payload, isAdd, cascade);
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
