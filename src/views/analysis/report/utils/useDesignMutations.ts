import { computed, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type { ReportDesign } from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";
import { REPORT_TABLE_LIMIT, REPORT_TEMPLATES } from "./design";
import { useDesignComponents } from "./useDesignComponents";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 报表设计器的设计变更操作（模板 / 明细列 / 行数上限 + 组件增删改排复）。
 * 全部改在本地 design 副本上并标脏，「保存」才提交后端；组件级操作见
 * useDesignComponents（行数门禁拆分，对外返回面不变）。
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

  return {
    components,
    applyTemplate,
    onColumnsChange,
    onLimitChange,
    ...useDesignComponents({
      design,
      selectedId,
      components,
      dataset,
      markDirty,
      t
    })
  };
}
