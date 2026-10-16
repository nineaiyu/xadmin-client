import { reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import { createFormDataApi } from "@/api/dataset/dform";
import {
  cascaderOptionsOf,
  isCascaderField,
  isNumberField,
  isOptionedField,
  isUserField
} from "./filters";
import { useFormDataSelection } from "./useFormDataSelection";
import { useFormDataFilters } from "./useFormDataFilters";
import { useFormDataColumns } from "./useFormDataColumns";
import { useFormDataUserLabels } from "./useFormDataUserLabels";
import { createFormDataDetailOpener } from "./formDataDetail";
import { useFormDataButtons } from "./formDataButtons";

/**
 * 表单数据（管理端）页面装配：顶部「选择表单」卡片（选择后以 key 重建表格，
 * 动态列随 schema 重新生成）、框架接管的搜索/分页/列设置/导出、按 schema 展开的
 * 动态列与只读「详情」行操作；行可见性由后端数据权限编译器收敛（非超管按授权
 * fail-closed）。子模块：选择/筛选/列装配/选人回显/详情/按钮（见同目录模块）。
 */
export function useFormData() {
  const { t } = useI18n();
  const tableRef = ref();

  // 工厂化：本页独立实例持有 form/filterData/dataFields，由下方 watch 维护取值
  const formDataApi = createFormDataApi();
  const api = reactive(formDataApi);
  const auth = usePageAuth(["exportData", "exportAsync", "formOptions"]);
  // 管理端只读：关闭框架默认的新增 / 编辑 / 删除入口
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  auth.destroy = false;
  auth.batchDestroy = false;

  // 顶部「选择表单」卡片：表单清单与所选 schema
  const {
    forms,
    selectedFormPk,
    selectedForm,
    schemaFields,
    formsLoadFailed,
    loadForms
  } = useFormDataSelection({ api });

  // 字段筛选（物化筛选列）与字典/选人候选
  const {
    filterableFields,
    filterValues,
    applyFilters,
    clearFilters,
    dictCache,
    optionsOf,
    filterUserOptionsOf,
    filterUserLabel,
    searchFilterUsers
  } = useFormDataFilters({ schemaFields, api, tableRef });

  // 选人字段回显（pk → 展示名，与筛选回显共用）
  const { userLabels } = useFormDataUserLabels({ api, schemaFields, tableRef });

  // 列装配：动态列/状态列/搜索区裁剪
  const { listColumnsFormat, searchColumnsFormat } = useFormDataColumns({
    t,
    dictCache,
    userLabels,
    schemaFields
  });

  // 切换表单：写入请求参数、清空字段筛选（旧表单的条件对新表单无意义），页面
  // 按 selectedFormPk 重建 RePlusPage。data_fields 以动态列 key 收缩行内 data
  // 载荷（与 form-options 下发口径同源；详情/导出不受影响）
  watch(selectedFormPk, pk => {
    api.form = pk;
    api.dataFields = schemaFields.value.map(field => field.key).join(",");
    api.filterData = "";
    for (const key of Object.keys(filterValues)) delete filterValues[key];
  });

  const openDetail = createFormDataDetailOpener({
    t,
    retrieve: pk => formDataApi.retrieve(pk)
  });

  const { operationButtonsProps } = useFormDataButtons({ t, openDetail });

  return {
    api,
    auth,
    tableRef,
    forms,
    formsLoadFailed,
    loadForms,
    selectedFormPk,
    selectedForm,
    listColumnsFormat,
    searchColumnsFormat,
    operationButtonsProps,
    // 字段筛选（物化筛选列）：可筛选字段、取值、应用/清空与渲染辅助
    filterableFields,
    filterValues,
    applyFilters,
    clearFilters,
    isOptionedField,
    isNumberField,
    isUserField,
    isCascaderField,
    filterOptionsOf: optionsOf,
    filterUserOptionsOf,
    filterUserLabel,
    searchFilterUsers,
    cascaderOptionsOf
  };
}
