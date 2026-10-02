import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { FieldChoices, MenuChoices } from "@/views/system/constants";
import { menuApi } from "@/api/system/menu";
import { handleTree, type TreeResult } from "@/utils/tree";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { modelLabelFieldApi } from "@/api/system/field";
import { transformI18n } from "@/plugins/i18n";
import { formatFiledAppParent } from "@/views/system/hooks";
import type { RecordType } from "plus-pro-components";
import type { FieldLookupItem } from "../components/utils/types";
import { menuTypeOf, type MenuScopeRow } from "../components/utils/menuScope";

/**
 * 数据权限页注册表数据源：规则字段/字段权限注册表、规则类型选项与匹配符文案、
 * 全量菜单行。自 useDataPermission 拆出（行为不变）：
 * 菜单全量列表与菜单页 / 角色页 / 权限页共用缓存（菜单页为权威刷新方 force）。
 */
export function usePermissionLookups() {
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

  return {
    fieldLookupsData,
    fieldLookupsRole,
    valuesData,
    matchTexts,
    menuRows,
    menuContextOptions
  };
}
