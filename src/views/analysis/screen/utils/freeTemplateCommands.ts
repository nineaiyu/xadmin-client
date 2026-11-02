import type { ConfirmOptions } from "@/hooks/useConfirm";
import type { FreeTemplate } from "./freeTemplates";
import { showServerTemplateDetail } from "./freeTemplateDetail";
import type { TemplateToolbarEmit, TFunction } from "./templateToolbar";

export interface TemplateCommandContext {
  t: TFunction;
  emit: TemplateToolbarEmit;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  askName: (title: string) => Promise<string | null>;
  openVersions: (id: string, name: string) => void;
  serverTemplates: { value: FreeTemplate[] };
}

/**
 * 模板菜单命令分发（自 useTemplateToolbarCommands 抽出，行数门禁）：
 * 「追加 / 替换」二选一按「确认 = 前者」语义；重命名与删除走同一套确认弹窗；
 * 数据效果一律 emit 上抛，这里只收集意图。
 */
export async function runTemplateCommand(
  ctx: TemplateCommandContext,
  command: string
): Promise<void> {
  const { t, emit, confirm } = ctx;
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
    const name = await ctx.askName(t("dataScreen.templateRename"));
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
    const name = await ctx.askName(t("dataScreen.templateRename"));
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
    const target = ctx.serverTemplates.value.find(item => item.id === id);
    ctx.openVersions(id, target?.name ?? "");
    return;
  }
  if (action === "server-detail") {
    await showServerTemplateDetail(id, t);
    return;
  }
  if (action === "export") emit("exportTemplate", id);
}
