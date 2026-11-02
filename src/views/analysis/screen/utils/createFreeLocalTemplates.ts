import { ref, type Ref } from "vue";
import { downloadTextFile } from "@/utils/download";
import { message } from "@/utils/message";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { FreeDesign } from "./freeLayout";
import {
  listTemplates,
  removeTemplate,
  renameTemplate,
  saveTemplate,
  type FreeTemplate
} from "./freeTemplates";
import { exportTemplateJson } from "./templateJson";
import type { PaneInserter } from "./freeInserter";
import {
  applyFreeTemplate,
  importFreeTemplateJson
} from "./freeTemplateInsert";
import type { TranslateFn } from "./types";
import type { TemplateApplyMode } from "./createFreeTemplates";

export type FreeLocalTemplateApi = ReturnType<typeof createFreeLocalTemplates>;

/** 「我的模板」（本地）：保存 / 应用 / 导入 / 重命名 / 删除 / 导出 */
export function createFreeLocalTemplates(deps: {
  t: TranslateFn;
  design: Ref<FreeDesign>;
  panes: Ref<ScreenLayoutPane[]>;
  selection: Ref<string[]>;
  inserter: PaneInserter;
  serverTemplates: Ref<FreeTemplate[]>;
}) {
  const templates = ref<FreeTemplate[]>([]);

  const refresh = () => {
    templates.value = listTemplates(deps.t);
  };

  /** 内置 + 我的 + 团队：应用 / 导出按同一个 id 空间查找（团队 id = 服务端 pk） */
  const findTemplate = (id: string) =>
    listTemplates(deps.t).find(item => item.id === id) ??
    deps.serverTemplates.value.find(item => item.id === id);

  /**
   * 保存当前自由画布为本地模板（名称由 UI 收集；空名称 / 空画布给出可读提示）。
   * 入口区分：有选区按选区保存，无选区回落**全量画布**（与团队模板口径、
   * 「保存为模板」按钮文案一致），画布本身为空才报 empty。
   */
  function saveCurrent(name: string): boolean {
    const result = saveTemplate({
      name,
      design: deps.design.value,
      panes: deps.panes.value,
      pks: deps.selection.value
    });
    if (!result.ok) {
      message(deps.t(templateErrorKey(result.error)), { type: "warning" });
      return false;
    }
    refresh();
    message(
      deps.t("dataScreen.templateSaved", { name: result.template.name }),
      { type: "success" }
    );
    return true;
  }

  /** 应用模板：替换（含画幅）/ 追加；插入链路与粘贴一致 */
  function apply(id: string, mode: TemplateApplyMode): boolean {
    return applyFreeTemplate(deps, findTemplate(id), mode);
  }

  /** 导入 JSON：解析（不信任外部文件）→ 走同一条插入链路 */
  function importJson(raw: string, mode: TemplateApplyMode): boolean {
    return importFreeTemplateJson(deps, raw, mode);
  }

  function rename(id: string, name: string): boolean {
    if (!renameTemplate(id, name)) return false;
    refresh();
    message(deps.t("dataScreen.templateRenamed"), { type: "success" });
    return true;
  }

  function remove(id: string): boolean {
    if (!removeTemplate(id)) return false;
    refresh();
    message(deps.t("dataScreen.templateRemoved"), { type: "success" });
    return true;
  }

  /** 导出为 JSON 文件（文件名带模板名；下载不可用时提示，不抛） */
  function exportJson(id: string): boolean {
    const template = findTemplate(id);
    if (!template) {
      message(deps.t("dataScreen.templateMissing"), { type: "warning" });
      return false;
    }
    const ok = downloadTextFile(
      `screen-template-${template.name}.json`,
      exportTemplateJson(template)
    );
    message(
      deps.t(
        ok ? "dataScreen.templateExportDone" : "dataScreen.templateExportFailed"
      ),
      { type: ok ? "success" : "warning" }
    );
    return ok;
  }

  return {
    templates,
    refresh,
    saveCurrent,
    apply,
    importJson,
    rename,
    remove,
    exportJson
  };
}

/** 保存失败的错误码 → 可读提示（键名集中在此，便于与语言包对齐） */
function templateErrorKey(
  error: "empty" | "name" | "limit" | "storage"
): string {
  if (error === "name") return "dataScreen.templateNameRequired";
  if (error === "empty") return "dataScreen.templateEmptyCanvas";
  if (error === "limit") return "dataScreen.templateLimit";
  return "dataScreen.templateStorageFailed";
}
