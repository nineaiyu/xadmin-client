import { computed, h, type Ref } from "vue";
import { getKeyList } from "@pureadmin/utils";
import type { RecordType } from "plus-pro-components";
import type { FieldLookupItem, FieldRuleRow } from "../components/utils/types";
import ScopeSelect from "../components/ScopeSelect.vue";
import ModeSelect from "../components/ModeSelect.vue";
import RuleListEditor from "../components/RuleListEditor.vue";
import type { MenuScopeRow } from "../components/utils/menuScope";
import type { TreeResult } from "@/utils/tree";

type LookupRows = Ref<TreeResult<RecordType>[]>;

/**
 * 列解析器上下文（与 RePlusPage 的 ColumnSpec 同形，做最小化声明）。
 * `column` 可缺失：键对应的元数据列只读时框架不会把它装进表单列集合
 * （如 `pk` 与统计列），解析器需按「本列不参与表单」处理。
 */
type ColumnCtx = {
  column?: Record<string, unknown> & { prop?: string };
  formValue?: Ref<RecordType>;
  rawRow?: RecordType;
  isAdd?: boolean;
};

/** 返回空值 = 该列不参与表单（框架跳过该键） */
type ColumnHandler = (ctx: ColumnCtx) => Record<string, unknown> | undefined;

const hideInForm: ColumnHandler = ({ column }) => {
  if (!column) return undefined;
  column["hideInForm"] = true;
  return column;
};

/**
 * 数据权限表单列装配（自 usePermissionFormOptions 拆出）：生效范围全量菜单树、
 * 且/或模式选择（联动规则条数）与规则编辑器（字段/值/匹配符候选注入 +
 * 试算面板上下文）。行值映射（menu / rules）同在此提供。
 */
export function buildPermissionFormColumns({
  fieldLookupsData,
  fieldLookupsRole,
  valuesData,
  matchTexts,
  menuRows,
  menuContextOptions
}: {
  fieldLookupsData: LookupRows;
  fieldLookupsRole: LookupRows;
  valuesData: Ref<FieldLookupItem[]>;
  matchTexts: Ref<Record<string, string>>;
  menuRows: Ref<MenuScopeRow[]>;
  menuContextOptions: Ref<{ value: string; label: string }[]>;
}) {
  /** 规则条数（表单值 Ref → 响应式计数，供「且/或」联动禁用） */
  const ruleCountOf = (formValue?: Ref<RecordType>) =>
    computed<number>(() => {
      const rules = (formValue?.value?.rules ?? []) as unknown[];
      return Array.isArray(rules) ? rules.length : 0;
    });

  /** 后端 menu choices 已截断，清掉 api-search 回退渲染器，改用全量菜单树 */
  const menu: ColumnHandler = ({ column }) => {
    if (!column) return undefined;
    // 全量菜单树接管该字段后，元数据派生的输入框 props（maxlength / showWordLimit /
    // multiple）不再适用：plus-pro 会把 fieldProps 透传给渲染组件，而 ScopeSelect
    // 是多根节点结构，继承不了这些非 prop 属性（Vue 会告警）
    column["fieldProps"] = {};
    delete column["renderField"];
    column["hasLabel"] = true;
    column["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) =>
      h(ScopeSelect, {
        rows: menuRows,
        modelValue: (Array.isArray(value) ? value : []) as string[],
        "onUpdate:modelValue": onChange
      });
    return column;
  };

  const modeType: ColumnHandler = ({ column, formValue }) => {
    if (!column) return undefined;
    column["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) =>
      h(ModeSelect, {
        modelValue: value,
        ruleCount: ruleCountOf(formValue),
        "onUpdate:modelValue": onChange
      });
    return column;
  };

  const rules: ColumnHandler = ({ column, formValue }) => {
    if (!column) return undefined;
    column["hasLabel"] = false;
    column["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) =>
      h(RuleListEditor, {
        class: ["w-full"],
        dataList: (value as FieldRuleRow[]) ?? [],
        valuesData: valuesData.value,
        matchTexts: matchTexts.value,
        ruleList: fieldLookupsData.value,
        fieldRuleList: fieldLookupsRole.value,
        menus: menuContextOptions.value,
        // 表单值 Ref：试算面板据此自动带入且/或模式与绑定菜单（草稿与保存同语义）
        formValue,
        onChange
      });
    return column;
  };

  return {
    row: {
      menu: ({ rawRow }: ColumnCtx) =>
        getKeyList(rawRow?.menu ?? [], "pk") ?? [],
      rules: ({ rawRow }: ColumnCtx) => rawRow?.rules ?? []
    },
    columns: {
      pk: hideInForm,
      // 统计列只在列表展示（后端列表 action 注解带出），不参与新增/编辑表单
      rule_count: hideInForm,
      menu_count: hideInForm,
      user_count: hideInForm,
      dept_count: hideInForm,
      menu,
      mode_type: modeType,
      rules
    }
  };
}
