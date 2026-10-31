import type { ConfirmOptions } from "@/hooks/useConfirm";
import type { TemplateToolbarEmit, TFunction } from "./templateToolbar";

interface SaveServerPromptContext {
  t: TFunction;
  emit: TemplateToolbarEmit;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  askName: (title: string) => Promise<string | null>;
  askOptionalText: (title: string, prompt: string) => Promise<string>;
}

interface ImportFileContext {
  t: TFunction;
  emit: TemplateToolbarEmit;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

/** 另存为团队模板：名称 + 可见性（确认 = 团队共享，取消 = 仅自己可见） */
export async function promptSaveServerTemplate(
  ctx: SaveServerPromptContext
): Promise<void> {
  const { t, emit } = ctx;
  const name = await ctx.askName(t("dataScreen.templateSaveServer"));
  if (!name) return;
  const group = await ctx.askOptionalText(
    t("dataScreen.templateGroup"),
    t("dataScreen.templateGroupPrompt")
  );
  const shared = await ctx.confirm(t("dataScreen.templateVisibilityHint"), {
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

/** 导入：读文件 → 选方式（确认 = 替换当前画布，取消 = 追加） */
export async function handleTemplateFilePicked(
  ctx: ImportFileContext,
  event: Event
): Promise<void> {
  const { t, emit, confirm } = ctx;
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
