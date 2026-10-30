import { isSuccess } from "@/api/types";
import { computed, onMounted, ref, type Ref } from "vue";
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
  /** 菜单列表权限缺失：生效范围树恒为空 */
  const menuDenied = ref(!hasAuth("list:SystemMenu"));
  /** 字段注册表权限缺失：规则字段候选恒为空 */
  const fieldDenied = ref(!hasAuth("list:SystemModelLabelField"));
  /** 任一依赖数据加载失败（业务码失败 / 网络异常） */
  const loadFailed = ref(false);

  /** 缺失的权限点（用于页面提示；空数组 = 权限齐全） */
  const missingPermissions = computed(() => {
    const missing: string[] = [];
    if (menuDenied.value) missing.push("list:SystemMenu");
    if (fieldDenied.value) missing.push("list:SystemModelLabelField");
    return missing;
  });

  /** 依赖不可用：缺权限或加载失败时禁用新增/编辑，避免在空表单里配置无效规则 */
  const lookupBlocked = computed(
    () => missingPermissions.value.length > 0 || loadFailed.value
  );
  /** 试算的菜单上下文候选 = 页面菜单（绑定菜单的授权只在该页面上下文生效） */
  const menuContextOptions = computed(() =>
    menuRows.value
      .filter(item => menuTypeOf(item) === MenuChoices.MENU)
      .map(item => ({
        value: String(item.pk),
        label: transformI18n(item.meta?.title) ?? String(item.pk)
      }))
  );

  const markFailed = () => {
    loadFailed.value = true;
  };

  /** 字段注册表按 field_type 加载：业务失败与网络异常都落到统一的失败标记 */
  const loadFieldRows = (
    fieldType: number,
    target: Ref<TreeResult<RecordType>[]>
  ) =>
    fetchAllRows(modelLabelFieldApi.list, { field_type: fieldType })
      .then(res => {
        if (!isSuccess(res)) return markFailed();
        formatFiledAppParent(res.data.results);
        target.value = handleTree(res.data.results);
      })
      .catch(markFailed);

  onMounted(() => {
    if (!menuDenied.value) {
      // 菜单全量列表与菜单页 / 角色页 / 权限页共用缓存；菜单页为权威刷新方（force）
      fetchMetaList(META_KEYS.menu, () => fetchAllRows(menuApi.list))
        .then(res => {
          if (isSuccess(res))
            menuRows.value = res.data.results as MenuScopeRow[];
          else markFailed();
        })
        .catch(markFailed);
    }
    if (!fieldDenied.value) {
      loadFieldRows(FieldChoices.DATA, fieldLookupsData);
      loadFieldRows(FieldChoices.ROLE, fieldLookupsRole);
    }
    modelLabelFieldApi
      .choices()
      .then(res => {
        if (!isSuccess(res)) return markFailed();
        const choicesDict = res.choices_dict as {
          choices?: FieldLookupItem[];
          matches?: Record<string, string>;
        };
        valuesData.value = choicesDict?.choices ?? [];
        matchTexts.value = choicesDict?.matches ?? {};
      })
      .catch(markFailed);
  });

  return {
    fieldLookupsData,
    fieldLookupsRole,
    valuesData,
    matchTexts,
    menuRows,
    menuContextOptions,
    menuDenied,
    fieldDenied,
    missingPermissions,
    lookupBlocked
  };
}
