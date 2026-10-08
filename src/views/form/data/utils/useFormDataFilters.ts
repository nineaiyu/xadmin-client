import { computed, reactive, watch } from "vue";
import type {
  FormDataApi,
  FormField,
  FormUserOption
} from "@/api/dataset/dform";
import { getDictItems, type DictItem } from "@/utils/dict";
import {
  buildFilterPayload,
  filterableFieldsOf,
  filterOptionsOf
} from "./filters";
import { userLabelText } from "./userData";
import type { Ref } from "vue";

/**
 * 表单数据（管理端）字段筛选（物化筛选列）。
 * 自 useFormData 拆出（行为不变）：可筛选字段、取值与应用/清空、字典项与选人候选、
 * 字典缓存预取（select/radio 的 value → label 映射共用，见 dictCache）。
 */
export function useFormDataFilters({
  schemaFields,
  api,
  tableRef
}: {
  schemaFields: Ref<FormField[]>;
  api: Pick<FormDataApi, "filterData" | "userOptions">;
  tableRef: Ref;
}) {
  /** 可筛选字段（设计器勾选 filterable 且类型可渲染筛选控件） */
  const filterableFields = computed<FormField[]>(() =>
    filterableFieldsOf(schemaFields.value)
  );
  /** 筛选取值（字段 key → 取值；空值不参与条件） */
  const filterValues = reactive<Record<string, unknown>>({});

  /** 收集非空筛选条件写入请求参数（JSON 字符串，后端按可筛选面 fail-closed 校验） */
  const syncFilterData = () => {
    api.filterData = buildFilterPayload(filterableFields.value, filterValues);
  };

  /** 应用筛选：写参数并重载列表（导出沿用同参数） */
  const applyFilters = () => {
    syncFilterData();
    tableRef.value?.handleGetData?.();
  };

  /** 清空筛选（含选择器回显） */
  const clearFilters = () => {
    for (const key of Object.keys(filterValues)) delete filterValues[key];
    applyFilters();
  };

  /** 字典项缓存（字典 code → 选项）：select/radio 的 value → label 映射 */
  const dictCache = reactive<Record<string, DictItem[]>>({});

  /** 筛选下拉候选项（字典项读页面缓存） */
  const optionsOf = (field: FormField) =>
    filterOptionsOf(field, field.dict ? dictCache[field.dict] : undefined);

  /** 选人筛选候选缓存（远程搜索）：字段 key → 候选列表 */
  const filterUserOptions = reactive<Record<string, FormUserOption[]>>({});
  const filterUserOptionsOf = (field: FormField) =>
    filterUserOptions[field.key] ?? [];
  const filterUserLabel = userLabelText;

  /** 选人筛选项远程搜索（空关键字清空候选，避免无边界枚举通讯录） */
  const searchFilterUsers = (field: FormField, keyword: string) => {
    const value = (keyword ?? "").trim();
    if (!value) {
      filterUserOptions[field.key] = [];
      return;
    }
    api
      .userOptions({ keyword: value })
      .then(res => {
        filterUserOptions[field.key] = res?.data ?? [];
      })
      .catch(() => {
        filterUserOptions[field.key] = [];
      });
  };

  // 字典字段预取（select/radio 的 value → label 映射；接口带缓存）
  watch(
    schemaFields,
    fields => {
      for (const field of fields) {
        if (!field.dict || dictCache[field.dict]) continue;
        getDictItems(field.dict)
          .then(items => {
            dictCache[field.dict as string] = items ?? [];
          })
          .catch(() => undefined);
      }
    },
    { immediate: true }
  );

  return {
    filterableFields,
    filterValues,
    applyFilters,
    clearFilters,
    dictCache,
    optionsOf,
    filterUserOptionsOf,
    filterUserLabel,
    searchFilterUsers
  };
}
