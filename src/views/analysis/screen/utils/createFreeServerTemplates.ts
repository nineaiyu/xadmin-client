import { ref, type Ref } from "vue";
import { message } from "@/utils/message";
import type {
  ScreenLayoutPane,
  ScreenTemplateVersionItem
} from "@/api/dataset/analysis";
import type { FreeDesign } from "./freeLayout";
import {
  fetchServerTemplates,
  fetchTemplateVersions,
  removeServerTemplate,
  renameServerTemplate,
  rollbackTemplate,
  saveServerTemplate,
  type TemplateWriteResult
} from "./serverTemplates";
import type { FreeTemplate } from "./freeTemplates";
import type { TranslateFn } from "./types";

export type FreeServerTemplateApi = ReturnType<
  typeof createFreeServerTemplates
>;

/** 团队模板（服务端）：拉取 / 另存 / 重命名 / 删除 / 版本与回滚 */
export function createFreeServerTemplates(deps: {
  t: TranslateFn;
  design: Ref<FreeDesign>;
  panes: Ref<ScreenLayoutPane[]>;
}) {
  const serverTemplates = ref<FreeTemplate[]>([]);

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
    const write: TemplateWriteResult = await saveServerTemplate({
      name: trimmed.slice(0, 40),
      group: group.trim().slice(0, 40),
      design: deps.design.value,
      panes: deps.panes.value,
      visibility
    });
    message(
      write.ok
        ? deps.t("dataScreen.templateServerSaved")
        : write.detail || deps.t("dataScreen.templateServerFailed"),
      { type: write.ok ? "success" : "warning" }
    );
    if (write.ok) await refreshServer();
    return write.ok;
  }

  async function renameServer(id: string, name: string): Promise<boolean> {
    const write = await renameServerTemplate(id, name.trim().slice(0, 40));
    message(
      write.ok
        ? deps.t("dataScreen.templateRenamed")
        : write.detail || deps.t("dataScreen.templateServerWriteDenied"),
      { type: write.ok ? "success" : "warning" }
    );
    if (write.ok) await refreshServer();
    return write.ok;
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
  const versions = (id: string): Promise<ScreenTemplateVersionItem[]> =>
    fetchTemplateVersions(id);

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

  return {
    serverTemplates,
    refreshServer,
    saveToServer,
    renameServer,
    removeServer,
    versions,
    rollback
  };
}
