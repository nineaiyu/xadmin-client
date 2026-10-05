/**
 * 菜单新增/编辑抽屉编排：打开（新增/编辑/克隆）、脏检查、保存、快速重命名。
 *
 * 新增与编辑共用**同一个抽屉**（旧实现：新增走弹窗、编辑走常驻表单，两套壳）；
 * 关闭/取消/切换节点三处都做未保存拦截，避免静默丢弃编辑内容。
 *
 * 子模块：快速重命名 useMenuRename / 权限码生成 useMenuPermissionCode
 * （两者与抽屉核心状态无耦合）；类型推断 inferType 归入 normalize.ts（纯函数）。
 */

import { h, ref, type Ref, type Reactive } from "vue";
import type { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import MenuDrawerForm from "../components/MenuDrawerForm.vue";
import { emptyFormModel, inferType, toFormModel } from "./normalize";
import { displayTitle } from "./useMenuFilter";
import { useMenuRename } from "./useMenuRename";
import { useMenuPermissionCode } from "./useMenuPermissionCode";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuFormModel,
  MenuRow,
  MenuUrlItem,
  ModelTreeItem
} from "./types";
import type { menuApi } from "@/api/system/menu";

type TFunction = ReturnType<typeof useI18n>["t"];

interface MenuDrawerDeps {
  api: Reactive<typeof menuApi>;
  auth: MenuAuths;
  t: TFunction;
  treeData: Ref<MenuRow[]>;
  rowIndex: Ref<{ byPk: Map<string, MenuRow> }>;
  choicesDict: Ref<Record<string, MenuChoiceItem[]>>;
  modelList: Ref<ModelTreeItem[]>;
  viewList: Ref<Record<string, string>>;
  menuUrlList: Ref<MenuUrlItem[]>;
  saveNode: (
    model: MenuFormModel,
    isAdd: boolean
  ) => Promise<{ code: number; detail?: string }>;
  renameNode: (
    row: MenuRow,
    title: string
  ) => Promise<{ code: number; detail?: string }>;
  setRowsActive: (rows: MenuRow[], isActive: boolean) => Promise<boolean>;
  reload: () => void;
  /** 保存后定位到该节点（可选） */
  onSaved?: (pk: number | string | undefined, isAdd: boolean) => void;
}

/** 未保存变更的处置结果 */
export type UnsavedChoice = "save" | "discard" | "cancel";

export function useMenuDrawer({
  api,
  auth,
  t,
  treeData,
  rowIndex,
  choicesDict,
  modelList,
  viewList,
  menuUrlList,
  saveNode,
  renameNode,
  setRowsActive,
  reload,
  onSaved
}: MenuDrawerDeps) {
  const confirm = useConfirm();
  const formRef = ref();
  const current = ref<{ pk?: number | string; isAdd: boolean } | null>(null);
  let options: DrawerOptions | null = null;

  const isOpen = () => Boolean(current.value);
  const openPk = () => current.value?.pk;
  const dirty = () => Boolean(formRef.value?.isDirty?.());

  const close = () => {
    if (options) closeDrawer(options, 0, { command: "close" });
    options = null;
    current.value = null;
    formRef.value = undefined;
  };

  /** 关闭前拦截未保存变更（取消按钮与右上角/ESC 两条路径都覆盖） */
  const guard = (done: () => void) => {
    if (!dirty()) {
      done();
      return;
    }
    confirm(t("systemMenu.confirm.unsaved"), {
      title: t("systemMenu.confirm.unsavedTitle"),
      confirmButtonText: t("systemMenu.action.discard")
    }).then(ok => {
      if (ok) done();
    });
  };

  /** 执行保存：返回是否成功（失败保留抽屉与输入） */
  const performSave = async (
    model: MenuFormModel,
    isAdd: boolean,
    cascadePks: Array<number | string>
  ): Promise<boolean> => {
    const res = await saveNode(model, isAdd).catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    if (res.code !== SUCCESS_CODE) {
      message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      return false;
    }
    // 停用目录时可选「连同子级一起停用」：主保存成功后批量落库子树
    if (!model.isActive && cascadePks.length) {
      const rows = cascadePks
        .map(pk => rowIndex.value.byPk.get(String(pk)))
        .filter((row): row is MenuRow => Boolean(row));
      await setRowsActive(rows, false);
    }
    message(t("results.success"), { type: "success" });
    onSaved?.(model.pk, isAdd);
    return true;
  };

  const open = (
    model: MenuFormModel,
    isAdd: boolean,
    title: string,
    pk?: number | string
  ) => {
    // 切换节点/连续新增时避免抽屉叠层：先收起上一个
    if (current.value && options) close();
    current.value = { pk, isAdd };
    const drawer: DrawerOptions = {
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
            const ok = await performSave(payload, isAdd, cascade);
            if (ok) {
              options = null;
              current.value = null;
              formRef.value = undefined;
              done();
            }
            closeLoading();
          })
          .catch(() => closeLoading());
      },
      beforeCancel: guard,
      beforeClose: guard,
      closeCallBack: ({ args }) => {
        // 用户经右上角/ESC/遮罩关闭：清理打开态（避免脏检查误判为"仍在编辑"）
        if (args?.command !== "sure") {
          options = null;
          current.value = null;
          formRef.value = undefined;
        }
      }
    };
    options = drawer;
    addDrawer(drawer);
  };

  /** 新增（无父级 = 顶级；有父级 = 其子级，类型按父级推断） */
  const openCreate = (parent?: MenuRow | null) => {
    const model = emptyFormModel(parent ?? null, inferType(parent ?? null));
    if (parent) model.parent = parent.pk;
    open(
      model,
      true,
      parent
        ? t("systemMenu.dialog.addChild", { title: displayTitle(parent) })
        : t("systemMenu.dialog.add")
    );
  };

  /** 编辑 */
  const openEdit = (row: MenuRow) => {
    open(toFormModel(row), false, t("systemMenu.dialog.edit"), row.pk);
  };

  /** 克隆：以现有节点为模板打开新增（同父级，标题/编码加副本后缀，先改后存） */
  const openClone = (row: MenuRow) => {
    const source = rowIndex.value.byPk.get(String(row.pk)) ?? row;
    const model = toFormModel(source);
    model.pk = undefined;
    model.title = t("systemMenu.dialog.cloneSuffix", {
      title: displayTitle(source)
    });
    model.name = `${source.name}_copy`;
    model.isActive = false;
    open(model, true, t("systemMenu.dialog.clone"));
  };

  // 快速重命名与权限码生成（与抽屉核心状态无耦合的独立弹窗动作）
  const { openRename } = useMenuRename({ t, renameNode });
  const { openPermission } = useMenuPermissionCode({
    t,
    menuUrlList,
    reload
  });

  /** 切换节点前的未保存拦截 */
  const confirmSwitch = async (): Promise<UnsavedChoice> => {
    if (!isOpen() || !dirty()) return "discard";
    try {
      await ElMessageBox.confirm(
        t("systemMenu.confirm.unsaved"),
        t("systemMenu.confirm.unsavedTitle"),
        {
          confirmButtonText: t("systemMenu.action.saveAndSwitch"),
          cancelButtonText: t("systemMenu.action.discard"),
          distinguishCancelAndClose: true,
          type: "warning"
        }
      );
      return "save";
    } catch (action) {
      return action === "cancel" ? "discard" : "cancel";
    }
  };

  /** 保存当前抽屉（「保存并切换」用；成功后关闭抽屉） */
  const saveCurrent = async (): Promise<boolean> => {
    const form = formRef.value;
    const valid = await form?.validate?.();
    if (!valid) return false;
    const payload = form.getPayload() as MenuFormModel;
    const ok = await performSave(
      payload,
      Boolean(current.value?.isAdd),
      (form.getCascadePks?.() ?? []) as Array<number | string>
    );
    if (ok) close();
    return ok;
  };

  return {
    formRef,
    isOpen,
    openPk,
    dirty,
    openCreate,
    openEdit,
    openClone,
    openRename,
    openPermission,
    confirmSwitch,
    saveCurrent,
    close,
    api
  };
}
