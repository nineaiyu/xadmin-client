import { h } from "vue";
import { ElOption, ElSelect } from "element-plus";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import RuleLevelsField from "../components/RuleLevelsField.vue";
import RulePathsEditor from "../components/RulePathsEditor.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

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
 * 审批规则表单的三条字段渲染器（自 useRuleFormOptions 抽出，行数门禁）：
 * - `path_patterns`（JSON）→ 接口清单勾选 + 自定义正则编辑器；
 * - `methods`（JSON）→ 固定候选多选；
 * - `levels`（嵌套级次子表）→ 级次编辑器 + 载荷适配层。
 */
export function buildRuleFormColumns({ t }: { t: TFunction }) {
  return {
    path_patterns: ({ column }: { column: RecordType }) => {
      column.label = t("approvalRule.formPaths");
      column.renderField = (
        value: unknown,
        onChange: (value: unknown) => void
      ) =>
        h(RulePathsEditor, {
          modelValue: (value as string[] | undefined) ?? [],
          "onUpdate:modelValue": onChange
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
            "onUpdate:modelValue": onChange
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
      column.fieldProps = { ...column.fieldProps, min: 0 };
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
    }
  };
}
