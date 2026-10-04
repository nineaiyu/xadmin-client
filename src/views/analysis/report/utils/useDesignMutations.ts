import { computed, type Ref } from "vue";
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
  REPORT_TABLE_LIMIT,
  REPORT_TEMPLATES,
  duplicateComponent,
  genComponentId,
  moveComponent
} from "./design";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 报表设计器的设计变更操作（模板 / 明细列 / 行数上限 / 组件增删改排复）。
 * 全部改在本地 design 副本上并标脏，「保存」才提交后端；抽出独立 composable
 * 控制页面体积（行数门禁）。
 */
export function useDesignMutations({
  design,
  selectedId,
  dataset,
  markDirty,
  t
}: {
  design: Ref<ReportDesign>;
  selectedId: Ref<string>;
  dataset: Ref<DatasetItem | null>;
  markDirty: () => void;
  t: TFunction;
}) {
  const components = computed(() => design.value.components ?? []);

  /* ---------------- 模板 ---------------- */
  function applyTemplate(code: string) {
    if (!dataset.value) return;
    const template = REPORT_TEMPLATES.find(item => item.code === code);
    if (!template) return;
    design.value = template.build(dataset.value);
    selectedId.value = "";
    markDirty();
    message(t("dataReport.templateApplied", { name: t(template.labelKey) }), {
      type: "success"
    });
  }

  /* ---------------- 明细列与行数上限 ---------------- */
  const onColumnsChange = (values: string[]) => {
    design.value = { ...design.value, columns: values };
    markDirty();
  };

  const onLimitChange = (value: number) => {
    design.value = {
      ...design.value,
      table_limit: Math.min(
        Math.max(value || REPORT_TABLE_LIMIT.default, REPORT_TABLE_LIMIT.min),
        REPORT_TABLE_LIMIT.max
      )
    };
    markDirty();
  };

  /* ---------------- 组件增删改 ---------------- */
  function addComponent(type: ReportComponentType) {
    if (components.value.length >= REPORT_MAX_COMPONENTS) {
      message(t("dataReport.componentLimit", { max: REPORT_MAX_COMPONENTS }), {
        type: "warning"
      });
      return;
    }
    const firstColumn = dataset.value?.columns?.[0] ?? "";
    const component: ReportDesignComponent = {
      id: genComponentId(),
      type,
      span: DEFAULT_SPAN[type],
      metric: "count",
      value_field: "",
      // 指标卡无分组；图表类默认取首个数据集列，避免保存时才被服务端打回
      group_by: type === "number" ? "" : firstColumn
    };
    design.value = {
      ...design.value,
      components: [...components.value, component]
    };
    selectedId.value = component.id;
    markDirty();
  }

  function updateComponent(patch: Partial<ReportDesignComponent>) {
    design.value = {
      ...design.value,
      components: components.value.map(item =>
        item.id === selectedId.value ? { ...item, ...patch } : item
      )
    };
    markDirty();
  }

  function removeComponent(id: string) {
    design.value = {
      ...design.value,
      components: components.value.filter(item => item.id !== id)
    };
    if (selectedId.value === id) selectedId.value = "";
    markDirty();
  }

  /* ---------------- 组件排序 / 复制 ---------------- */
  function moveComponentBy(id: string, delta: -1 | 1) {
    const next = moveComponent(components.value, id, delta);
    if (next === components.value) return;
    design.value = { ...design.value, components: next };
    markDirty();
  }

  function duplicateComponentById(id: string) {
    const next = duplicateComponent(components.value, id);
    if (!next) {
      message(t("dataReport.componentLimit", { max: REPORT_MAX_COMPONENTS }), {
        type: "warning"
      });
      return;
    }
    design.value = { ...design.value, components: next };
    markDirty();
  }

  return {
    components,
    applyTemplate,
    onColumnsChange,
    onLimitChange,
    addComponent,
    updateComponent,
    removeComponent,
    moveComponentBy,
    duplicateComponentById
  };
}
