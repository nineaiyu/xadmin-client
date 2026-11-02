import type { Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { FreeDesign } from "./freeLayout";
import { createFreeLocalTemplates } from "./createFreeLocalTemplates";
import { createFreeServerTemplates } from "./createFreeServerTemplates";
import type { PaneInserter } from "./freeInserter";
import type { TranslateFn } from "./types";

export type TemplateApplyMode = "replace" | "append";

/**
 * 自由画布模板域：内置模板 + 「我的模板」（本地）+ **团队模板**（服务端）+ JSON 导入。
 *
 * 应用模板 / 粘贴 / 导入 JSON 共用插入链路（`PaneInserter`）：过滤不可见引用 → 新 pk →
 * 偏移 → 夹回 → 上限截断，并对**替换**模式采纳来源画幅（追加模式保持当前画幅）。
 * 这里不碰 UI：命名 / 确认弹窗 / 文件选择由工具条收集，本模块只执行数据效果并给提示。
 *
 * 组合层只做接线：本地模板域与团队模板域各自在 createFreeLocalTemplates /
 * createFreeServerTemplates 内实现（行数门禁拆分）。
 */
export function createFreeTemplates(deps: {
  t: TranslateFn;
  design: Ref<FreeDesign>;
  panes: Ref<ScreenLayoutPane[]>;
  selection: Ref<string[]>;
  inserter: PaneInserter;
}) {
  const server = createFreeServerTemplates(deps);
  const local = createFreeLocalTemplates({
    ...deps,
    serverTemplates: server.serverTemplates
  });

  return {
    templates: local.templates,
    serverTemplates: server.serverTemplates,
    refresh: local.refresh,
    refreshServer: server.refreshServer,
    saveCurrent: local.saveCurrent,
    saveToServer: server.saveToServer,
    apply: local.apply,
    rename: local.rename,
    renameServer: server.renameServer,
    remove: local.remove,
    removeServer: server.removeServer,
    importJson: local.importJson,
    exportJson: local.exportJson,
    versions: server.versions,
    rollback: server.rollback
  };
}

export type FreeTemplateApi = ReturnType<typeof createFreeTemplates>;
