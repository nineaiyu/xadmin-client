import { h, onScopeDispose, reactive, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { addDrawer } from "@/components/ReDrawer";
import type { OperationProps } from "@/components/RePlusPage";
import { usePageAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { formDataApi, type FormDataItem } from "@/api/dataset/dform";
import SubmissionDetail from "../../components/SubmissionDetail.vue";
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

/**
 * 表单数据（管理端）页面装配。
 *
 * 页面级形态：
 * - 顶部「选择表单」卡片：数据源为全部非模板表单（含停用），选择后重建表格
 *   （RePlusPage 以 key=表单 pk 重建：动态列随 schema 变化重新生成）；
 * - 表格区由框架接管搜索 / 分页 / 列设置 / 导出；行可见性由后端数据权限
 *   编译器收敛（超管全量、非超管按授权 fail-closed）；
 * - 动态列：按所选表单 schema 展开，字段值取自行数据 `data[key]`；
 * - 只读：仅「详情」行操作（提交与改动在「我的填报」）。
 *
 * 子模块：表单选择 useFormDataSelection / 字段筛选 useFormDataFilters /
 * 列装配 useFormDataColumns / 选人回显 useFormDataUserLabels。
 */
export function useFormData() {
  const { t } = useI18n();
  const tableRef = ref();

  const api = reactive(formDataApi);
  // 单例 api 携带 form/filterData/dataFields 跨页面挂载存活：进入页面即收敛
  // 为空，防止上一实例的筛选/列参数泄漏进本实例首屏请求（卸载时同样重置兜底，
  // 覆盖"请求在途时离开页面"的残留）；页面存活期间由下方 watch 维护取值
  const resetPageParams = () => {
    formDataApi.form = "";
    formDataApi.filterData = "";
    formDataApi.dataFields = "";
  };
  resetPageParams();
  onScopeDispose(resetPageParams);
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
  } = useFormDataSelection();

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
  const { userLabels } = useFormDataUserLabels({ schemaFields, tableRef });

  // 列装配：动态列/状态列/搜索区裁剪
  const { listColumnsFormat, searchColumnsFormat } = useFormDataColumns({
    t,
    schemaFields,
    dictCache,
    userLabels
  });

  // 切换表单：写入请求参数、清空字段筛选（旧表单的条件对新表单无意义）；
  // 页面按 selectedFormPk 重建 RePlusPage（首屏自动重载）。
  // 动态列 key 集合同步写入（当前 ∪ 历史字段，与 form-options 下发口径同源）：
  // 列表请求以 data_fields 收缩行内 data 载荷（缺省全量；详情/导出不受影响）
  watch(selectedFormPk, pk => {
    api.form = pk;
    api.dataFields = schemaFields.value.map(field => field.key).join(",");
    api.filterData = "";
    for (const key of Object.keys(filterValues)) delete filterValues[key];
  });

  /** 详情抽屉：先取详情（列表契约不含 schema 快照 / 审批轨迹），失败回落行数据 */
  const openDetail = async (row: FormDataItem) => {
    const res = await formDataApi.retrieve(row.pk).catch(() => null);
    if (res?.code !== SUCCESS_CODE) {
      // 回落列表行数据（无 schema 快照 / 审批轨迹）：显式提示，不静默降级
      message(t("dform.detailFallback"), { type: "info" });
    }
    const detail =
      res?.code === SUCCESS_CODE ? (res.data as unknown as FormDataItem) : row;
    addDrawer({
      title: `${detail.form_name} - ${String(detail.pk).slice(0, 8).toUpperCase()}`,
      size: "45%",
      destroyOnClose: true,
      closeOnClickModal: true,
      hideFooter: true,
      props: { row: detail },
      contentRenderer: () => h(SubmissionDetail)
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 120,
    showNumber: 2,
    hideDetail: true,
    buttons: [
      { code: "update", show: false },
      { code: "delete", show: false },
      {
        text: t("dform.detail"),
        code: "data-detail",
        props: {
          type: "primary",
          link: true,
          "data-testid": "form-data-detail"
        },
        show: () => -10,
        onClick: ({ row }) => openDetail(row as FormDataItem)
      }
    ]
  });

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
