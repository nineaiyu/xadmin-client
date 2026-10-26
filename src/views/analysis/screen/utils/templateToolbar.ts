import { ref, type ComputedRef } from "vue";
import { useConfirm } from "@/hooks/useConfirm";
import { usePrompt } from "@/hooks/useMessageBox";
import type { FreeTemplate } from "./freeTemplates";
import { showServerTemplateDetail } from "./freeTemplateDetail";
import type { TemplateApplyMode } from "./createFreeEditor";
import type { FreeGridSnap } from "./freeSnap";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** FreeCanvasToolbar 的完整事件表（defineEmits 与组合层 emit 调用共用同一形状） */
export type FreeCanvasToolbarEmits = {
  zoom: [value: number];
  fit: [];
  copy: [];
  paste: [];
  grid: [value: FreeGridSnap];
  /** 模板回滚（版本历史弹窗触发） */
  rollbackTemplate: [payload: { id: string; version: number }];
  /** 从云端粘贴（跨设备剪贴板） */
  pasteCloud: [];
  clearCloud: [];
  saveTemplate: [name: string];
  saveServerTemplate: [
    payload: {
      name: string;
      /** 分组名（可空 = 未分组） */
      group: string;
      visibility: "personal" | "shared";
    }
  ];
  applyTemplate: [payload: { id: string; mode: TemplateApplyMode }];
  renameTemplate: [payload: { id: string; name: string }];
  removeTemplate: [id: string];
  exportTemplate: [id: string];
  renameServerTemplate: [payload: { id: string; name: string }];
  removeServerTemplate: [id: string];
  importTemplate: [payload: { raw: string; mode: TemplateApplyMode }];
};

/** 工具条向上抛的模板类事件（FreeCanvasToolbar 的 defineEmits 的子集） */
export type TemplateToolbarEmit = {
  (e: "saveTemplate", name: string): void;
  (
    e: "saveServerTemplate",
    payload: {
      name: string;
      /** 分组名（可空 = 未分组） */
      group: string;
      visibility: "personal" | "shared";
    }
  ): void;
  (e: "applyTemplate", payload: { id: string; mode: TemplateApplyMode }): void;
  (e: "renameTemplate", payload: { id: string; name: string }): void;
  (e: "removeTemplate", id: string): void;
  (e: "exportTemplate", id: string): void;
  (e: "renameServerTemplate", payload: { id: string; name: string }): void;
  (e: "removeServerTemplate", id: string): void;
  (
    e: "importTemplate",
    payload: { raw: string; mode: TemplateApplyMode }
  ): void;
};

/**
 * 自由画布工具条的模板命令交互层（自 FreeCanvasToolbar 抽出，行数门禁）。
 *
 * 弹窗类交互（命名 / 可见性 / 替换确认 / 文件选择 / 版本历史弹窗状态）在此收口，
 * 数据效果一律经 emit 上抛给组合层执行——这里只收集意图，不碰窗格数据。
 * 「二选一」的弹窗（可见性、导入方式）统一用「确认 = 前者 / 取消 = 后者」，
 * 语义写进各自的标题文案，避免多写一层自绘对话框。
 */
export function useTemplateToolbarCommands(deps: {
  t: TFunction;
  emit: TemplateToolbarEmit;
  serverTemplates: ComputedRef<FreeTemplate[]>;
}) {
  const { t, emit } = deps;
  const confirm = useConfirm();

  /* 版本历史弹窗（自管拉取，回滚经组合层执行） */
  const versionsVisible = ref(false);
  const versionsId = ref("");
  const versionsName = ref("");
  function openVersions(id: string, name: string) {
    versionsId.value = id;
    versionsName.value = name;
    versionsVisible.value = true;
  }

  /** 命名输入（保存 / 重命名共用）：取消返回 null，输入为空由 inputValidator 拦住 */
  async function askName(title: string, initial = ""): Promise<string | null> {
    const answer = await usePrompt()(
      t("dataScreen.templateNamePrompt"),
      title,
      {
        inputValue: initial,
        confirmButtonText: t("dataScreen.templateSave"),
        cancelButtonText: t("dataScreen.cancel"),
        inputValidator: value =>
          Boolean(value?.trim()) || t("dataScreen.templateNameRequired")
      }
    );
    return answer?.value.trim() ? answer.value.trim() : null;
  }

  /** 可选文本（取消 = 空串）：用于「分组名」这类可留空的输入 */
  async function askOptionalText(
    title: string,
    prompt: string
  ): Promise<string> {
    const answer = await usePrompt()(prompt, title, {
      confirmButtonText: t("dataScreen.templateSave"),
      cancelButtonText: t("dataScreen.cancel")
    });
    return answer?.value.trim() ?? "";
  }

  async function onSaveTemplate() {
    const name = await askName(t("dataScreen.templateSave"));
    if (name) emit("saveTemplate", name);
  }

  /** 另存为团队模板：名称 + 可见性（确认 = 团队共享，取消 = 仅自己可见） */
  async function onSaveServerTemplate() {
    const name = await askName(t("dataScreen.templateSaveServer"));
    if (!name) return;
    const group = await askOptionalText(
      t("dataScreen.templateGroup"),
      t("dataScreen.templateGroupPrompt")
    );
    const shared = await confirm(t("dataScreen.templateVisibilityHint"), {
      type: "",
      title: t("dataScreen.templateSaveServer"),
      confirmButtonText: t("dataScreen.templateVisibilityShared"),
      cancelButtonText: t("dataScreen.templateVisibilityPersonal")
    });
    emit("saveServerTemplate", {
      name,
      group: group ?? "",
      visibility: shared ? "shared" : "personal"
    });
  }

  const fileInput = ref<HTMLInputElement>();

  function onImportClick() {
    fileInput.value?.click();
  }

  /** 导入：读文件 → 选方式（确认 = 替换当前画布，取消 = 追加） */
  async function onFilePicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const raw = await file.text().catch(() => "");
    if (!raw) return;
    const replace = await confirm(t("dataScreen.templateImportModeHint"), {
      type: "",
      title: t("dataScreen.templateImport"),
      confirmButtonText: t("dataScreen.templateApplyReplace"),
      cancelButtonText: t("dataScreen.templateApplyAppend")
    });
    emit("importTemplate", { raw, mode: replace ? "replace" : "append" });
  }

  async function onCommand(command: string) {
    const [action, id] = command.split(":");
    if (!id) return;
    if (action === "append") {
      emit("applyTemplate", { id, mode: "append" });
      return;
    }
    if (action === "replace") {
      // 替换会覆盖当前画布内容：危险色确认 + 焦点不落确认钮（防回车误触）
      if (
        await confirm(t("dataScreen.templateReplaceConfirm"), {
          title: t("dataScreen.templateMenu"),
          confirmButtonText: t("dataScreen.templateApplyReplace"),
          danger: true
        })
      ) {
        emit("applyTemplate", { id, mode: "replace" });
      }
      return;
    }
    if (action === "rename") {
      const name = await askName(t("dataScreen.templateRename"));
      if (name) emit("renameTemplate", { id, name });
      return;
    }
    if (action === "remove") {
      if (
        await confirm(t("dataScreen.templateDeleteConfirm"), {
          title: t("dataScreen.templateDelete"),
          danger: true
        })
      ) {
        emit("removeTemplate", id);
      }
      return;
    }
    if (action === "server-rename") {
      const name = await askName(t("dataScreen.templateRename"));
      if (name) emit("renameServerTemplate", { id, name });
      return;
    }
    if (action === "server-remove") {
      if (
        await confirm(t("dataScreen.templateDeleteConfirm"), {
          title: t("dataScreen.templateDelete"),
          danger: true
        })
      ) {
        emit("removeServerTemplate", id);
      }
      return;
    }
    if (action === "versions") {
      const target = deps.serverTemplates.value.find(item => item.id === id);
      openVersions(id, target?.name ?? "");
      return;
    }
    if (action === "server-detail") {
      await showServerTemplateDetail(id, t);
      return;
    }
    if (action === "export") emit("exportTemplate", id);
  }

  return {
    versionsVisible,
    versionsId,
    versionsName,
    fileInput,
    onSaveTemplate,
    onSaveServerTemplate,
    onImportClick,
    onFilePicked,
    onCommand
  };
}
