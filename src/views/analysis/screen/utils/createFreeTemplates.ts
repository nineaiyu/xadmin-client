import { ref, type Ref } from "vue";
import { downloadTextFile } from "@/utils/download";
import { message } from "@/utils/message";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { clampDesign, type FreeDesign } from "./freeLayout";
import {
  listTemplates,
  removeTemplate,
  renameTemplate,
  saveTemplate,
  templatePanes,
  type FreeTemplate
} from "./freeTemplates";
import {
  fetchServerTemplates,
  fetchTemplateVersions,
  removeServerTemplate,
  renameServerTemplate,
  rollbackTemplate,
  saveServerTemplate,
  templateWriteError
} from "./serverTemplates";
import type { ScreenTemplateVersionItem } from "@/api/dataset/analysis";
import { exportTemplateJson, parseTemplateJson } from "./templateJson";
import type { PaneInserter } from "./freeInserter";
import type { TranslateFn } from "./types";

export type TemplateApplyMode = "replace" | "append";

/**
 * 自由画布模板域：内置模板 + 「我的模板」（本地）+ **团队模板**（服务端）+ JSON 导入。
 *
 * 应用模板 / 粘贴 / 导入 JSON 共用插入链路（`PaneInserter`）：过滤不可见引用 → 新 pk →
 * 偏移 → 夹回 → 上限截断，并对**替换**模式采纳来源画幅（追加模式保持当前画幅）。
 * 这里不碰 UI：命名 / 确认弹窗 / 文件选择由工具条收集，本模块只执行数据效果并给提示。
 */
export function createFreeTemplates(deps: {
  t: TranslateFn;
  design: Ref<FreeDesign>;
  panes: Ref<ScreenLayoutPane[]>;
  selection: Ref<string[]>;
  inserter: PaneInserter;
}) {
  const templates = ref<FreeTemplate[]>([]);
  const serverTemplates = ref<FreeTemplate[]>([]);

  const refresh = () => {
    templates.value = listTemplates(deps.t);
  };

  /** 内置 + 我的 + 团队：应用 / 导出按同一个 id 空间查找（团队 id = 服务端 pk） */
  const findTemplate = (id: string) =>
    listTemplates(deps.t).find(item => item.id === id) ??
    serverTemplates.value.find(item => item.id === id);

  /* ---------------- 团队模板（服务端） ---------------- */

  /** 拉取团队模板（失败静默降级为空列表：不挡住本地模板与画布编辑） */
  async function refreshServer(): Promise<number> {
    serverTemplates.value = await fetchServerTemplates();
    return serverTemplates.value.length;
  }

  /** 另存为团队模板：名称 + 可见性（本地模板与团队模板各自独立，互不覆盖） */
  async function saveToServer(
    name: string,
    visibility: "personal" | "shared",
    group = ""
  ): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) {
      message(deps.t("dataScreen.templateNameRequired"), { type: "warning" });
      return false;
    }
    if (deps.panes.value.length === 0) {
      message(deps.t("dataScreen.templateEmptyCanvas"), { type: "warning" });
      return false;
    }
    const ok = await saveServerTemplate({
      name: trimmed.slice(0, 40),
      group: group.trim().slice(0, 40),
      design: deps.design.value,
      panes: deps.panes.value,
      visibility
    });
    message(
      ok
        ? deps.t("dataScreen.templateServerSaved")
        : templateWriteError() || deps.t("dataScreen.templateServerFailed"),
      { type: ok ? "success" : "warning" }
    );
    if (ok) await refreshServer();
    return ok;
  }

  async function renameServer(id: string, name: string): Promise<boolean> {
    const ok = await renameServerTemplate(id, name.trim().slice(0, 40));
    message(
      ok
        ? deps.t("dataScreen.templateRenamed")
        : templateWriteError() ||
            deps.t("dataScreen.templateServerWriteDenied"),
      { type: ok ? "success" : "warning" }
    );
    if (ok) await refreshServer();
    return ok;
  }

  async function removeServer(id: string): Promise<boolean> {
    const ok = await removeServerTemplate(id);
    message(
      deps.t(
        ok
          ? "dataScreen.templateRemoved"
          : "dataScreen.templateServerWriteDenied"
      ),
      { type: ok ? "success" : "warning" }
    );
    if (ok) await refreshServer();
    return ok;
  }

  /** 模板历史版本（只读）：无版本或失败返回空数组（UI 给空态） */
  async function versions(id: string): Promise<ScreenTemplateVersionItem[]> {
    return fetchTemplateVersions(id);
  }

  /** 回滚到指定版本：成功后刷新团队模板列表（名称 / 分组 / 载荷都变了） */
  async function rollback(id: string, version: number): Promise<boolean> {
    const updated = await rollbackTemplate(id, version);
    if (!updated) {
      message(deps.t("dataScreen.templateRollbackFailed"), { type: "warning" });
      return false;
    }
    await refreshServer();
    message(deps.t("dataScreen.templateRolledBack", { n: version }), {
      type: "success"
    });
    return true;
  }

  /* ---------------- 本地模板 ---------------- */

  /** 保存当前自由画布为本地模板（名称由 UI 收集；空名称 / 空画布给出可读提示） */
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
      {
        type: "success"
      }
    );
    return true;
  }

  /** 应用模板：替换（含画幅）/ 追加；插入链路与粘贴一致 */
  function apply(id: string, mode: TemplateApplyMode): boolean {
    const template = findTemplate(id);
    if (!template) {
      message(deps.t("dataScreen.templateMissing"), { type: "warning" });
      return false;
    }
    if (mode === "replace") deps.design.value = clampDesign(template.design);
    const inserted = deps.inserter.insert(templatePanes(template), {
      replace: mode === "replace"
    });
    if (inserted === 0) return false;
    message(deps.t("dataScreen.templateApplied", { name: template.name }), {
      type: "success"
    });
    return true;
  }

  /**
   * 导入 JSON：解析（不信任外部文件）→ 走同一条插入链路。
   * 形状不对只提示不落数据；窗格被丢弃的数量由插入链路统一计数提示。
   */
  function importJson(raw: string, mode: TemplateApplyMode): boolean {
    const parsed = parseTemplateJson(raw);
    if (!parsed.ok) {
      message(deps.t(templateImportKey(parsed.error)), { type: "warning" });
      return false;
    }
    if (mode === "replace")
      deps.design.value = clampDesign(parsed.value.design);
    const inserted = deps.inserter.insert(parsed.value.panes, {
      replace: mode === "replace"
    });
    if (inserted === 0) return false;
    message(deps.t("dataScreen.templateImported", { n: inserted }), {
      type: "success"
    });
    return true;
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
    serverTemplates,
    refresh,
    refreshServer,
    saveCurrent,
    saveToServer,
    apply,
    rename,
    renameServer,
    remove,
    removeServer,
    importJson,
    exportJson,
    versions,
    rollback
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

/** 导入失败的错误码 → 可读提示 */
function templateImportKey(error: "format" | "empty" | "too-large"): string {
  if (error === "empty") return "dataScreen.templateImportEmpty";
  if (error === "too-large") return "dataScreen.templateImportTooLarge";
  return "dataScreen.templateImportFormat";
}

export type FreeTemplateApi = ReturnType<typeof createFreeTemplates>;
