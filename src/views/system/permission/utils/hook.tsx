import { SUCCESS_CODE } from "@/api/types";
import { dataPermissionApi } from "@/api/system/permission";
import {
  computed,
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef,
  type Ref
} from "vue";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import {
  FieldChoices,
  MenuChoices,
  ModeChoices
} from "@/views/system/constants";
import { menuApi } from "@/api/system/menu";
import { handleTree, type TreeResult } from "@/utils/tree";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { modelLabelFieldApi } from "@/api/system/field";
import { transformI18n } from "@/plugins/i18n";
import { useI18n } from "vue-i18n";
import { getKeyList } from "@pureadmin/utils";
import { ElTag } from "element-plus";
import type { RecordType } from "plus-pro-components";
import type {
  OperationProps,
  PageTableColumn,
  RePlusPageProps
} from "@/components/RePlusPage";
import type {
  FieldLookupItem,
  FieldLookupNode,
  FieldRuleRow
} from "../components/utils/types";
import { menuTypeOf, type MenuScopeRow } from "../components/utils/menuScope";
import { parseFormMode } from "../components/utils/trial";
import ScopeSelect from "../components/ScopeSelect.vue";
import ModeSelect from "../components/ModeSelect.vue";
import RuleListEditor from "../components/RuleListEditor.vue";
import { formatFiledAppParent } from "@/views/system/hooks";

export function useDataPermission() {
  const { t } = useI18n();
  /** 数据权限字段注册表（DATA）：规则字段候选与试算模型候选 */
  const fieldLookupsData = ref<TreeResult<RecordType>[]>([]);
  /** 字段权限注册表（ROLE）：字段试算草稿候选 */
  const fieldLookupsRole = ref<TreeResult<RecordType>[]>([]);
  /** 规则类型选项（后端 choices 下发，含值控件元数据与分组） */
  const valuesData = ref<FieldLookupItem[]>([]);
  /** 匹配符中文文案（与预览解码同源，用于规则摘要） */
  const matchTexts = ref<Record<string, string>>({});
  /** 全量菜单行：生效范围树与试算菜单上下文 */
  const menuRows = ref<MenuScopeRow[]>([]);

  const api = reactive(dataPermissionApi);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance())
  });

  /** 试算的菜单上下文候选 = 页面菜单（绑定菜单的授权只在该页面上下文生效） */
  const menuContextOptions = computed(() =>
    menuRows.value
      .filter(item => menuTypeOf(item) === MenuChoices.MENU)
      .map(item => ({
        value: String(item.pk),
        label: transformI18n(item.meta?.title) ?? String(item.pk)
      }))
  );

  onMounted(() => {
    if (hasAuth("list:SystemMenu")) {
      // 菜单全量列表与菜单页 / 角色页 / 权限页共用缓存；菜单页为权威刷新方（force）
      fetchMetaList(META_KEYS.menu, () => fetchAllRows(menuApi.list)).then(
        res => {
          if (res.code === SUCCESS_CODE) {
            menuRows.value = res.data.results as MenuScopeRow[];
          }
        }
      );
    }
    if (hasAuth("list:SystemModelLabelField")) {
      fetchAllRows(modelLabelFieldApi.list, {
        field_type: FieldChoices.DATA
      }).then(res => {
        if (res.code === SUCCESS_CODE) {
          formatFiledAppParent(res.data.results);
          fieldLookupsData.value = handleTree(res.data.results);
        }
      });
      fetchAllRows(modelLabelFieldApi.list, {
        field_type: FieldChoices.ROLE
      }).then(res => {
        if (res.code === SUCCESS_CODE) {
          formatFiledAppParent(res.data.results);
          fieldLookupsRole.value = handleTree(res.data.results);
        }
      });
    }
    modelLabelFieldApi.choices().then(res => {
      if (res.code === SUCCESS_CODE) {
        const choicesDict = res.choices_dict as {
          choices?: FieldLookupItem[];
          matches?: Record<string, string>;
        };
        valuesData.value = choicesDict?.choices ?? [];
        matchTexts.value = choicesDict?.matches ?? {};
      }
    });
  });

  /** 规则条数（表单值 Ref → 响应式计数，供「且/或」联动禁用） */
  const ruleCountOf = (formValue?: Ref<RecordType>) =>
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
              ruleList: fieldLookupsData.value as unknown as FieldLookupNode[],
              fieldRuleList:
                fieldLookupsRole.value as unknown as FieldLookupNode[],
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

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 160,
    buttons: [{ code: "detail", show: false }]
  });

  /** 「且/或」模式标签（单条规则时服务端统一按或模式保存，标注避免误读） */
  const modeTag = (modeType: unknown, ruleCount: number) => {
    if (ruleCount < 2) {
      return h(ElTag, { effect: "plain", size: "small", type: "info" }, () =>
        t("systemPermission.list.modeSingle")
      );
    }
    const mode = parseFormMode(modeType);
    const isAnd = mode === ModeChoices.AND;
    return h(
      ElTag,
      { effect: "plain", size: "small", type: isAnd ? "warning" : "primary" },
      () =>
        isAnd
          ? t("systemPermission.modeAndShort")
          : t("systemPermission.modeOrShort")
    );
  };

  /** 生效范围标签：未绑定菜单 = 通用（全部接口生效） */
  const scopeTag = (menuCount: unknown) => {
    const count = Number(menuCount ?? 0);
    if (!count) {
      return h(ElTag, { effect: "plain", size: "small", type: "info" }, () =>
        t("systemPermission.list.scopeAll")
      );
    }
    return h(ElTag, { effect: "plain", size: "small", type: "success" }, () =>
      t("systemPermission.list.scopeApis", { count })
    );
  };

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      const key = column._column?.key as string;
      switch (key) {
        case "name":
          column["minWidth"] = 180;
          break;
        case "mode_type":
          column["width"] = 110;
          column["cellRenderer"] = ({ row }) =>
            modeTag(row.mode_type, Number(row.rule_count ?? 0));
          break;
        // 统计列的表头文案走 `systemPermission.<字段名>` 词条（rule_count / menu_count /
        // user_count / dept_count），与框架 formatPublicLabels 的口径一致
        case "rule_count":
          column["width"] = 90;
          column["cellRenderer"] = ({ row }) => String(row.rule_count ?? 0);
          break;
        case "menu_count":
          column["minWidth"] = 150;
          column["cellRenderer"] = ({ row }) => scopeTag(row.menu_count);
          break;
        case "user_count":
        case "dept_count":
          column["width"] = 100;
          column["cellRenderer"] = ({ row }) => String(row[key] ?? 0);
          break;
        case "created_time":
          column["width"] = 170;
          break;
        default:
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps
  };
}
