import { computed } from "vue";
import { rawValueOf } from "./maskModelFieldOptions";
import type { Ref } from "vue";

/** 模型/字段候选条目（value = 协议字段名） */
type LabelValueOption = { value: string; label: string };

/** 列解析器上下文（与 RePlusPage 的 ColumnSpec 同形，做最小化声明） */
type ColumnCtx = {
  column: Record<string, unknown>;
  formValue?: Ref<Record<string, unknown>>;
};

type ColumnHandler = (ctx: ColumnCtx) => Record<string, unknown>;

/**
 * 新增/编辑弹窗列调整（自 hook.tsx 抽出）：模型/字段候选下拉（候选是字典快照，
 * 未同步进字典的模型仍允许手填）与 pattern 仅在 mask_type=custom 时展示。
 */
export function buildMaskFormColumns({
  canPickModel,
  modelOptions,
  fieldOptionsMap
}: {
  canPickModel: boolean;
  modelOptions: Ref<LabelValueOption[]>;
  fieldOptionsMap: Ref<Record<string, LabelValueOption[]>>;
}) {
  const model: ColumnHandler = ({ column }) => {
    if (canPickModel) {
      column["valueType"] = "select";
      column["fieldProps"] = {
        ...((column["fieldProps"] as object) ?? {}),
        filterable: true,
        allowCreate: true
      };
      column["options"] = computed(() => modelOptions.value);
    }
    return column;
  };

  const field: ColumnHandler = ({ column, formValue }) => {
    if (canPickModel) {
      column["valueType"] = "select";
      column["fieldProps"] = {
        ...((column["fieldProps"] as object) ?? {}),
        filterable: true,
        allowCreate: true
      };
      // computed 内读取表单值：模型切换后字段候选自动联动
      column["options"] = computed(
        () =>
          fieldOptionsMap.value[rawValueOf(formValue?.value?.model) ?? ""] ?? []
      );
    }
    return column;
  };

  const pattern: ColumnHandler = ({ column, formValue }) => {
    const isCustom = () => {
      const v = formValue?.value?.mask_type as
        { value?: string } | string | undefined;
      return rawValueOf(v) === "custom";
    };
    column["hideInForm"] = computed(() => !isCustom());
    return column;
  };

  return { model, field, pattern };
}
