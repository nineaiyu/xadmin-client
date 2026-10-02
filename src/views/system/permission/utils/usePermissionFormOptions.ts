import { computed, h, shallowRef, type Ref } from "vue";
import { getKeyList } from "@pureadmin/utils";
import type { RecordType } from "plus-pro-components";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { FieldLookupItem, FieldRuleRow } from "../components/utils/types";
import ScopeSelect from "../components/ScopeSelect.vue";
import ModeSelect from "../components/ModeSelect.vue";
import RuleListEditor from "../components/RuleListEditor.vue";
import type { MenuScopeRow } from "../components/utils/menuScope";
import type { TreeResult } from "@/utils/tree";

type LookupRows = Ref<TreeResult<RecordType>[]>;

/** 表单值 Ref（RePlusPage 弹层上下文形态） */
type FormValueRef = Ref<RecordType> | undefined;

/**
 * 数据权限新增/编辑弹层装配。
 * 自 useDataPermission 拆出（行为不变）：生效范围全量菜单树、且/或模式选择
 * （联动规则条数）与规则编辑器（字段/值/匹配符候选注入 + 试算面板上下文）。
 */
export function usePermissionFormOptions({
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
  const ruleCountOf = (formValue?: FormValueRef) =>
    computed<number>(() => {
      const rules = (formValue?.value?.rules ?? []) as unknown[];
      return Array.isArray(rules) ? rules.length : 0;
    });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        menu: ({ rawRow }: { rawRow?: RecordType }) => {
          return getKeyList(rawRow?.menu ?? [], "pk") ?? [];
        },
        rules: ({ rawRow }: { rawRow?: RecordType }) => {
          return rawRow?.rules ?? [];
        }
      },
      columns: {
        pk: ({ column }) => {
          column["hideInForm"] = true;
          return column;
        },
        // 统计列只在列表展示（后端列表 action 注解带出），不参与新增/编辑表单
        rule_count: ({ column }) => {
          column["hideInForm"] = true;
          return column;
        },
        menu_count: ({ column }) => {
          column["hideInForm"] = true;
          return column;
        },
        user_count: ({ column }) => {
          column["hideInForm"] = true;
          return column;
        },
        dept_count: ({ column }) => {
          column["hideInForm"] = true;
          return column;
        },
        menu: ({ column }) => {
          // 后端 menu choices 已截断，清掉 api-search 回退渲染器，改用全量菜单树
          // （页面/目录勾选在保存时被归一展开为其下全部接口权限点）
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
        },
        mode_type: ({ column, formValue }) => {
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
        },
        rules: ({ column, formValue }) => {
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
        }
      },
      // 新增与编辑共用右侧抽屉：规则编辑器 + 试算面板需要宽于默认弹窗的内容区
      mode: "drawer",
      dialogDrawerOptions: {
        width: "900px"
      }
    }
  });

  return {
    addOrEditOptions
  };
}
