import { h } from "vue";
import { ElInputNumber, ElOption, ElSelect, ElSwitch } from "element-plus";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import RuleLevelsField from "../components/RuleLevelsField.vue";
import RulePathsEditor from "../components/RulePathsEditor.vue";
import ApprovalRuleImpactField from "../components/ApprovalRuleImpactField.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 影响面预览用的可编辑草稿（与表单字段同步，供按钮读取实时值） */
export type RuleImpactDraft = {
  pk?: string;
  path_patterns: string[];
  methods: string[];
  priority: number;
  is_active: boolean;
};

export const createRuleImpactDraft = (): RuleImpactDraft => ({
  path_patterns: [],
  methods: [],
  priority: 0,
  is_active: true
});

export const syncRuleImpactDraft = (
  draft: RuleImpactDraft,
  row?: RecordType | null
) => {
  const source = (row ?? {}) as Record<string, unknown>;
  draft.pk = source.pk ? String(source.pk) : undefined;
  draft.path_patterns = Array.isArray(source.path_patterns)
    ? (source.path_patterns as string[])
    : [];
  draft.methods = Array.isArray(source.methods)
    ? (source.methods as string[])
    : [];
  draft.priority = Number(source.priority ?? 0) || 0;
  draft.is_active = source.is_active !== false;
};

/** 限定方法候选项（与后端 RULE_METHODS 白名单同源；空清单 = 不限方法） */
const METHOD_OPTIONS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD"
];

/**
 * 审批规则表单的字段渲染器（自 useRuleFormOptions 抽出，行数门禁）：
 * - `path_patterns`（JSON）→ 接口清单勾选 + 自定义正则编辑器；
 * - `methods`（JSON）→ 固定候选多选；
 * - `levels`（嵌套级次子表）→ 级次编辑器 + 载荷适配层；
 * - `impact_preview`（扩展字段）→ 草稿实时影响面预览。
 */
export function buildRuleFormColumns({
  t,
  draft,
  canPreview
}: {
  t: TFunction;
  draft: RuleImpactDraft;
  canPreview: boolean;
}) {
  return {
    path_patterns: ({ column }: { column: RecordType }) => {
      column.label = t("approvalRule.formPaths");
      column.renderField = (
        value: unknown,
        onChange: (value: unknown) => void
      ) =>
        h(RulePathsEditor, {
          modelValue: (value as string[] | undefined) ?? [],
          "onUpdate:modelValue": (next: string[]) => {
            draft.path_patterns = next;
            onChange(next);
          }
        });
      column.colProps = { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 };
      return column;
    },
    methods: ({ column }: { column: RecordType }) => {
      column.label = t("approvalRule.formMethods");
      column.renderField = (
        value: unknown,
        onChange: (value: unknown) => void
      ) =>
        h(
          ElSelect,
          {
            modelValue: (value as string[] | undefined) ?? [],
            multiple: true,
            clearable: true,
            collapseTags: true,
            collapseTagsTooltip: true,
            placeholder: t("approvalRule.methodsPlaceholder"),
            class: "w-full",
            "onUpdate:modelValue": (next: string[]) => {
              draft.methods = next;
              onChange(next);
            }
          },
          () =>
            METHOD_OPTIONS.map(method =>
              h(ElOption, { key: method, label: method, value: method })
            )
        );
      column.colProps = { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 };
      return column;
    },
    priority: ({ column }: { column: RecordType }) => {
      column.renderField = (
        value: unknown,
        onChange: (value: unknown) => void
      ) =>
        h(ElInputNumber, {
          modelValue: Number(value ?? 0),
          min: 0,
          class: "w-full",
          "onUpdate:modelValue": (next: number | undefined) => {
            draft.priority = Number(next ?? 0) || 0;
            onChange(next);
          }
        });
      return column;
    },
    is_active: ({ column }: { column: RecordType }) => {
      column.renderField = (
        value: unknown,
        onChange: (value: unknown) => void
      ) =>
        h(ElSwitch, {
          modelValue: value !== false,
          "onUpdate:modelValue": (next: string | number | boolean) => {
            const active = Boolean(next);
            draft.is_active = active;
            onChange(active);
          }
        });
      return column;
    },
    levels: ({ column }: { column: RecordType }) => {
      column.label = t("approvalRule.levels");
      column.renderField = (
        value: unknown,
        onChange: (value: unknown) => void
      ) =>
        h(RuleLevelsField, {
          modelValue: (value as RecordType[] | undefined) ?? [],
          "onUpdate:modelValue": onChange
        });
      column.colProps = { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 };
      return column;
    },
    impact_preview: ({ column }: { column: RecordType }) => {
      column.label = t("approvalRule.impactTitle");
      column.colProps = { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 };
      column.renderField = () =>
        h(ApprovalRuleImpactField, { draft, allowed: canPreview });
      return column;
    }
  };
}
