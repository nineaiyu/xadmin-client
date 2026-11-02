import { ref, type Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import { FREE_DESIGN_DEFAULTS } from "./freeLayout";
import type { FreeGridSnap } from "./freeSnap";
import { readClipboard } from "./freeClipboard";
import { createPaneInserter } from "./freeInserter";
import { createFreePaneOps } from "./freePaneOps";
import { createFreeTemplates } from "./createFreeTemplates";
import { readGridSnap, applyGridSnap } from "./gridPrefs";
import { useCanvasZoom } from "./useCanvasZoom";
import { createFreeSelection } from "./freeEditorSelection";
import { createFreePayloadApi } from "./freeEditorPayload";
import { createFreePaneCollection } from "./freeEditorPanes";
import { createFreeBoxApi } from "./freeEditorBoxApi";
import { createFreeGestures } from "./freeEditorGestures";
import { createFreeClipboard } from "./freeEditorClipboard";
import { assembleFreeEditorApi } from "./freeEditorApi";
import type { TranslateFn } from "./types";

/** 元素级网格吸附的本地记忆键（开关 + 步长；与本模块其它偏好同一命名空间） */

/**
 * 自由画布编辑域（设计器组装层与画布 / 面板之间的唯一接口）。
 *
 * 覆盖：载荷装载与组装、窗格增删改、**选择模型**（`selection` 为单一真相，单选目标
 * 由它派生）、**显示缩放**（`useCanvasZoom`，只作用于渲染与指针换算）、手势落数据
 * （组拖动整组一个撤销点）、对齐与分布、层级（含多选整组）、剪贴板与模板
 * （插入链路见 `freeInserter`，模板域见 `createFreeTemplates`）。
 * UI（弹窗 / 名称输入）不在此处：这里只吐数据、结果与提示。
 *
 * 组合层只负责接线：各分域语义在 freeEditor* 系列模块（行数门禁拆分）。
 */
export function createFreeEditor(deps: {
  t: TranslateFn;
  markDirty: () => void;
  pushHistory: (key?: string) => void;
  dashboards: Ref<DashboardItem[]>;
  datasets: Ref<DatasetItem[]>;
  /** 画布视口元素（画布板挂载后交出，缩放换算与锚点补偿用） */
  viewport: Ref<HTMLElement | undefined>;
}) {
  const design = ref({ ...FREE_DESIGN_DEFAULTS });
  const panes = ref<ScreenLayoutPane[]>([]);
  const selection = ref<string[]>([]);
  const hasClipboard = ref(Boolean(readClipboard()));
  const gridSnap = ref<FreeGridSnap>(readGridSnap());

  /** 网格吸附开关 / 步长：非法步长回落缺省，选择记忆在本地（换会话仍然生效） */
  const setGrid = (next: FreeGridSnap) => applyGridSnap(gridSnap, next);

  const zoomApi = useCanvasZoom({ design, viewport: deps.viewport });
  const selectionApi = createFreeSelection(panes, selection);
  const payloadApi = createFreePayloadApi({ design, panes, selection });

  const inserter = createPaneInserter({
    t: deps.t,
    panes,
    selection,
    design,
    dashboards: deps.dashboards,
    datasets: deps.datasets,
    pushHistory: deps.pushHistory,
    markDirty: deps.markDirty
  });
  const templateApi = createFreeTemplates({
    t: deps.t,
    design,
    panes,
    selection,
    inserter
  });
  const ops = createFreePaneOps({
    panes,
    design,
    select: pk => selectionApi.selectPk(pk),
    current: () => (selection.value.length === 1 ? selection.value[0] : ""),
    pushHistory: deps.pushHistory,
    t: deps.t
  });
  const paneApi = createFreePaneCollection({
    ops,
    panes,
    selection,
    pushHistory: deps.pushHistory,
    markDirty: deps.markDirty
  });
  const boxApi = createFreeBoxApi({
    panes,
    selection,
    design,
    gridSnap,
    pushHistory: deps.pushHistory
  });
  const gestureApi = createFreeGestures({
    panes,
    design,
    selection,
    pushHistory: deps.pushHistory,
    markDirty: deps.markDirty,
    boxApi
  });
  const clipboardApi = createFreeClipboard({
    panes,
    selection,
    design,
    inserter,
    hasClipboard,
    t: deps.t
  });

  return assembleFreeEditorApi({
    design,
    panes,
    selection,
    hasClipboard,
    gridSnap,
    setGrid,
    zoomApi,
    selectionApi,
    payloadApi,
    paneApi,
    gestureApi,
    boxApi,
    clipboardApi,
    templateApi
  });
}

export type FreeEditorApi = ReturnType<typeof createFreeEditor>;

/** 盒模型映射（手势 / 批量操作的公共类型） */
export type { FreeBoxMap } from "./freeEditorBoxApi";

/** 模板应用方式（工具条与组合层的公共契约） */
export type { TemplateApplyMode } from "./createFreeTemplates";
