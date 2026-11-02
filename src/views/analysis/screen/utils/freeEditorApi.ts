import type { Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { FreeDesign } from "./freeLayout";
import type { FreeGridSnap } from "./freeSnap";
import type { useCanvasZoom } from "./useCanvasZoom";
import type { FreeSelectionApi } from "./freeEditorSelection";
import type { FreePayloadApi } from "./freeEditorPayload";
import type { FreePaneCollectionApi } from "./freeEditorPanes";
import type { FreeGestureApi } from "./freeEditorGestures";
import type { FreeBoxApi } from "./freeEditorBoxApi";
import type { FreeClipboardApi } from "./freeEditorClipboard";
import type { FreeTemplateApi } from "./createFreeTemplates";

/**
 * 组装编辑域对外的 API 对象（自 createFreeEditor 抽出，行数门禁）。
 *
 * 只做字段归并，不含逻辑；各分域工厂见 freeEditor* 模块。返回形状与
 * createFreeEditor 的历史返回值一致（`FreeEditorApi` 由它派生）。
 */
export function assembleFreeEditorApi(parts: {
  design: Ref<FreeDesign>;
  panes: Ref<ScreenLayoutPane[]>;
  selection: Ref<string[]>;
  hasClipboard: Ref<boolean>;
  gridSnap: Ref<FreeGridSnap>;
  setGrid: (next: FreeGridSnap) => void;
  zoomApi: ReturnType<typeof useCanvasZoom>;
  selectionApi: FreeSelectionApi;
  payloadApi: FreePayloadApi;
  paneApi: FreePaneCollectionApi;
  gestureApi: FreeGestureApi;
  boxApi: FreeBoxApi;
  clipboardApi: FreeClipboardApi;
  templateApi: FreeTemplateApi;
}) {
  return {
    design: parts.design,
    panes: parts.panes,
    selection: parts.selection,
    ...parts.selectionApi,
    hasClipboard: parts.hasClipboard,
    gridSnap: parts.gridSnap,
    setGrid: parts.setGrid,
    ...parts.zoomApi,
    ...parts.payloadApi,
    ...parts.paneApi,
    ...parts.gestureApi,
    align: parts.boxApi.align,
    distribute: parts.boxApi.distribute,
    alignToGrid: parts.boxApi.alignToGrid,
    ...parts.clipboardApi,
    templates: parts.templateApi.templates,
    serverTemplates: parts.templateApi.serverTemplates,
    refreshTemplates: parts.templateApi.refresh,
    refreshServerTemplates: parts.templateApi.refreshServer,
    saveCurrentAsTemplate: parts.templateApi.saveCurrent,
    saveCurrentToServer: parts.templateApi.saveToServer,
    applyTemplate: parts.templateApi.apply,
    renameSavedTemplate: parts.templateApi.rename,
    renameServerTemplate: parts.templateApi.renameServer,
    removeSavedTemplate: parts.templateApi.remove,
    removeServerTemplate: parts.templateApi.removeServer,
    importTemplateJson: parts.templateApi.importJson,
    exportSavedTemplate: parts.templateApi.exportJson,
    templateVersions: parts.templateApi.versions,
    rollbackTemplate: parts.templateApi.rollback
  };
}
