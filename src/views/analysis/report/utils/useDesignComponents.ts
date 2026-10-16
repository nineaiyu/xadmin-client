import type { ComputedRef, Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type {
  ReportComponentType,
  ReportDesign,
  ReportDesignComponent
} from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";
import {
  DEFAULT_SPAN,
  REPORT_MAX_COMPONENTS,
  duplicateComponent,
  genComponentId,
  moveComponent
} from "./design";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 报表设计器的组件级变更（自 useDesignMutations 抽出，行数门禁）：增删改排复。
 * 全部改在本地 design 副本上并标脏，「保存」才提交后端；选中态随增删联动。
 */
export function useDesignComponents(deps: {
  design: Ref<ReportDesign>;
  selectedId: Ref<string>;
  components: ComputedRef<ReportDesignComponent[]>;
  dataset: Ref<DatasetItem | null>;
  markDirty: () => void;
  t: TFunction;
}) {
  function addComponent(type: ReportComponentType) {
    if (deps.components.value.length >= REPORT_MAX_COMPONENTS) {
      message(
        deps.t("dataReport.componentLimit", { max: REPORT_MAX_COMPONENTS }),
        { type: "warning" }
      );
      return;
    }
    const firstColumn = deps.dataset.value?.columns?.[0] ?? "";
    const component: ReportDesignComponent = {
      id: genComponentId(),
      type,
      span: DEFAULT_SPAN[type],
      metric: "count",
      value_field: "",
      // 指标卡无分组；图表类默认取首个数据集列，避免保存时才被服务端打回
      group_by: type === "number" ? "" : firstColumn
    };
    deps.design.value = {
      ...deps.design.value,
      components: [...deps.components.value, component]
    };
    deps.selectedId.value = component.id;
    deps.markDirty();
  }

  function updateComponent(patch: Partial<ReportDesignComponent>) {
    deps.design.value = {
      ...deps.design.value,
      components: deps.components.value.map(item =>
        item.id === deps.selectedId.value ? { ...item, ...patch } : item
      )
    };
    deps.markDirty();
  }

  function removeComponent(id: string) {
    deps.design.value = {
      ...deps.design.value,
      components: deps.components.value.filter(item => item.id !== id)
    };
    if (deps.selectedId.value === id) deps.selectedId.value = "";
    deps.markDirty();
  }

  function moveComponentBy(id: string, delta: -1 | 1) {
    const next = moveComponent(deps.components.value, id, delta);
    if (next === deps.components.value) return;
    deps.design.value = { ...deps.design.value, components: next };
    deps.markDirty();
  }

  function duplicateComponentById(id: string) {
    const next = duplicateComponent(deps.components.value, id);
    if (!next) {
      message(
        deps.t("dataReport.componentLimit", { max: REPORT_MAX_COMPONENTS }),
        { type: "warning" }
      );
      return;
    }
    deps.design.value = { ...deps.design.value, components: next };
    deps.markDirty();
  }

  return {
    addComponent,
    updateComponent,
    removeComponent,
    moveComponentBy,
    duplicateComponentById
  };
}
