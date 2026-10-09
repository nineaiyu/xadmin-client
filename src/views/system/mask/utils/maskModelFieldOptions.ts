import { onMounted, shallowRef } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { modelLabelFieldApi } from "@/api/system/field";
import { FieldChoices } from "@/views/system/constants";
import { fetchAllRows } from "@/utils/fetchAllRows";

/** 模型/字段候选条目（value = 协议字段名） */
interface LabelValueOption {
  value: string;
  label: string;
}

/** `parent` 为 object_related_field 下发对象（根节点为空），兼容裸 pk 形态 */
const parentPkOf = (parent: unknown) =>
  parent && typeof parent === "object"
    ? (parent as { pk?: string }).pk
    : (parent as string | undefined);

/** labeled_choice 可能是 {value,label} 或裸字符串 */
export const rawValueOf = (value: unknown) =>
  value && typeof value === "object"
    ? (value as { value?: string }).value
    : (value as string | undefined);

/**
 * 从列表行提取预览所需规则（行内「脱敏预览」预填当前行）。
 *
 * 只取掩码相关字段与 roles：model/field 仅用于弹窗展示，pattern 仅在 custom 时
 * 使用；roles 供预览视角默认选中与后端判定 viewer 命中。
 */
export function buildPreviewRule(row: Record<string, unknown>) {
  return {
    // model/field 仅用于弹窗展示「预览的是哪条规则」
    model: row?.model,
    field: row?.field,
    mask_type: rawValueOf(row?.mask_type),
    keep_head: row?.keep_head,
    keep_tail: row?.keep_tail,
    mask_char: row?.mask_char,
    pattern: row?.pattern,
    roles: row?.roles
  };
}

/**
 * 模型/字段候选（自 hook.tsx 抽出）：一次拉取全部角色侧模型字段（模型 + 字段，
 * 量级几百行），前端本地分组联动；无模型字段权限时保持空候选（下拉降级为输入框）。
 */
export function useMaskModelFieldOptions({
  canPickModel
}: {
  canPickModel: boolean;
}) {
  const modelOptions = shallowRef<LabelValueOption[]>([]);
  /** model(label_lower) → 该模型的序列化字段候选（field 口径与脱敏钩子一致） */
  const fieldOptionsMap = shallowRef<Record<string, LabelValueOption[]>>({});

  const loadModelFieldOptions = () => {
    if (!canPickModel) return;
    fetchAllRows(modelLabelFieldApi.list, { field_type: FieldChoices.ROLE })
      .then(res => {
        if (res.code !== SUCCESS_CODE || !res.data) return;
        const rows = res.data.results as Array<{
          pk: string;
          name: string;
          label?: string;
          parent?: unknown;
        }>;
        const nameOfPk = new Map(rows.map(row => [row.pk, row.name]));
        const labelOfPk = new Map(
          rows.map(row => [row.pk, row.label ?? row.name])
        );
        // 根节点（无 parent）= 模型
        const modelPks = new Set(
          rows.filter(row => !parentPkOf(row.parent)).map(row => row.pk)
        );
        modelOptions.value = rows
          .filter(row => modelPks.has(row.pk))
          .map(row => ({
            value: row.name,
            label:
              row.label && row.label !== row.name
                ? `${row.label} (${row.name})`
                : row.name
          }))
          .sort((a, b) => a.value.localeCompare(b.value));
        const map: Record<string, LabelValueOption[]> = {};
        rows.forEach(row => {
          const parentPk = parentPkOf(row.parent);
          const modelName = parentPk ? nameOfPk.get(parentPk) : undefined;
          if (!modelName || !parentPk || !modelPks.has(parentPk)) return;
          if (!map[modelName]) map[modelName] = [];
          map[modelName].push({
            value: row.name,
            label: labelOfPk.get(row.pk) ?? row.name
          });
        });
        fieldOptionsMap.value = map;
      })
      .catch(() => undefined);
  };

  onMounted(loadModelFieldOptions);

  return { modelOptions, fieldOptionsMap };
}
