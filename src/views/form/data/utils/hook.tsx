import { SUCCESS_CODE } from "@/api/types";
import { computed, h, onMounted, reactive, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { addDrawer } from "@/components/ReDrawer";
import {
  getDictItems,
  statusTagProps,
  type DictItem,
  type StatusTagType
} from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { usePageAuth } from "@/views/system/hooks";
import type { RecordType } from "plus-pro-components";
import {
  formDataApi,
  type FormDataFormOption,
  type FormDataItem,
  type FormField,
  type FormUserOption
} from "@/api/dataset/dform";
import SubmissionDetail from "../../components/SubmissionDetail.vue";
import {
  buildFilterPayload,
  cascaderOptionsOf,
  filterableFieldsOf,
  filterOptionsOf,
  isCascaderField,
  isNumberField,
  isOptionedField,
  isUserField
} from "./filters";
import { fieldValueText } from "./format";

/** 提交状态（审批回写）语义色兜底：与「我的填报」同口径（tag props 统一走 statusTagProps） */
const SUBMISSION_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  DRAFT: "info",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info"
};

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
 */
export function useFormData() {
  const { t } = useI18n();
  const tableRef = ref();
  const forms = ref<FormDataFormOption[]>([]);
  const selectedFormPk = ref("");
  const selectedForm = computed(
    () => forms.value.find(item => item.pk === selectedFormPk.value) ?? null
  );
  const schemaFields = computed<FormField[]>(
    () => selectedForm.value?.schema?.fields ?? []
  );

  const api = reactive(formDataApi);
  const auth = usePageAuth(["exportData", "exportAsync", "formOptions"]);
  // 管理端只读：关闭框架默认的新增 / 编辑 / 删除入口
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  auth.destroy = false;
  auth.batchDestroy = false;

  const asRow = (row: unknown) => row as FormDataItem;

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

  /** 筛选下拉候选项（字典项读页面缓存） */
  const optionsOf = (field: FormField) =>
    filterOptionsOf(field, field.dict ? dictCache[field.dict] : undefined);

  /** 选人筛选候选缓存（远程搜索）：字段 key → 候选列表 */
  const filterUserOptions = reactive<Record<string, FormUserOption[]>>({});
  const filterUserOptionsOf = (field: FormField) =>
    filterUserOptions[field.key] ?? [];
  const filterUserLabel = (user: FormUserOption) =>
    user.nickname ? `${user.username}-${user.nickname}` : user.username;

  /** 选人筛选项远程搜索（空关键字清空候选，避免无边界枚举通讯录） */
  const searchFilterUsers = (field: FormField, keyword: string) => {
    const value = (keyword ?? "").trim();
    if (!value) {
      filterUserOptions[field.key] = [];
      return;
    }
    formDataApi
      .userOptions({ keyword: value })
      .then(res => {
        filterUserOptions[field.key] = res?.data ?? [];
      })
      .catch(() => {
        filterUserOptions[field.key] = [];
      });
  };

  /** 字典项缓存（字典 code → 选项）：select/radio 的 value → label 映射 */
  const dictCache = reactive<Record<string, DictItem[]>>({});
  /** 选人字段回显缓存（pk → 展示名）：列表数据到达后按主键批量拉取 */
  const userLabels = reactive<Record<string, string>>({});

  const renderFieldCell = (field: FormField, value: unknown) =>
    h(
      "span",
      { class: "text-xs" },
      fieldValueText(field, value, {
        option: (item, raw) => {
          if (!item.dict) return undefined;
          const hit = (dictCache[item.dict] ?? []).find(
            option => String(option.value ?? "") === String(raw)
          );
          return hit ? hit.label : undefined;
        },
        user: pk => userLabels[pk],
        booleanText: value => (value ? t("dform.yes") : t("dform.no")),
        tableRows: count => t("formData.tableRows", { count })
      })
    );

  /** 状态列：字典色优先、缺省按状态语义兜底；无状态（无需审批）不留空 */
  const renderStatus = (row: FormDataItem) => {
    const status = row.status;
    if (!status?.value) {
      return h(
        "span",
        { class: "text-xs text-(--el-text-color-secondary)" },
        t("dform.noApprovalNeeded")
      );
    }
    return h(
      ElTag,
      {
        size: "small",
        "data-testid": "form-data-status-tag",
        ...statusTagProps(status, SUBMISSION_STATUS_TAG_TYPE)
      },
      () => status.label
    );
  };

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    const formatted: PageTableColumn[] = [];
    columns.forEach(column => {
      const key = column._column?.key as string;
      if (key === "form_name") {
        column["minWidth"] = 160;
        formatted.push(column);
        // 动态列：按所选表单 schema 展开（未选择表单时不生成）
        schemaFields.value.forEach(field => {
          formatted.push({
            _column: { key: `data.${field.key}` },
            label: field.label || field.key,
            minWidth: 140,
            cellRenderer: ({ row }: { row: RecordType }) =>
              renderFieldCell(field, asRow(row).data?.[field.key])
          } as unknown as PageTableColumn);
        });
        return;
      }
      if (key === "status") {
        column["width"] = 120;
        column["cellRenderer"] = ({ row }) => renderStatus(asRow(row));
      }
      if (key === "creator") column["width"] = 120;
      if (key === "created_time" || key === "updated_time")
        column["width"] = 170;
      formatted.push(column);
    });
    return formatted;
  };

  /** 搜索区：表单选择走页面顶部选择器（已注入列表请求），移除搜索区的重复入口 */
  const searchColumnsFormat = (columns: PageTableColumn[]) =>
    columns.filter(column => column._column?.key !== "form");

  /** 详情抽屉：先取详情（列表契约不含 schema 快照 / 审批轨迹），失败回落行数据 */
  const openDetail = async (row: FormDataItem) => {
    const res = await formDataApi.retrieve(row.pk).catch(() => null);
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
        onClick: ({ row }) => openDetail(asRow(row))
      }
    ]
  });

  /** 表单选项：全部非模板表单（含停用），默认选中第一个（打开即有数据） */
  const loadForms = async () => {
    const res = await formDataApi.formOptions().catch(() => null);
    if (res?.code !== SUCCESS_CODE) return;
    forms.value = (res.data ?? []) as FormDataFormOption[];
    if (!selectedFormPk.value && forms.value.length) {
      selectedFormPk.value = forms.value[0].pk;
    }
  };

  onMounted(loadForms);

  // 切换表单：写入请求参数、清空字段筛选（旧表单的条件对新表单无意义）；
  // 页面按 selectedFormPk 重建 RePlusPage（首屏自动重载）
  watch(selectedFormPk, pk => {
    api.form = pk;
    api.filterData = "";
    for (const key of Object.keys(filterValues)) delete filterValues[key];
  });

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

  // 选人字段回显：列表数据到达后收集 pk 批量请求（不枚举通讯录）
  const collectUserLabels = async (rows: FormDataItem[]) => {
    const pks = new Set<number>();
    for (const field of schemaFields.value) {
      if (field.type !== "user") continue;
      for (const row of rows) {
        const raw = row.data?.[field.key];
        for (const item of Array.isArray(raw) ? raw : [raw]) {
          const pk = Number(item);
          if (Number.isInteger(pk) && pk > 0) pks.add(pk);
        }
      }
    }
    const missing = [...pks].filter(pk => !userLabels[String(pk)]);
    if (!missing.length) return;
    const res = await formDataApi
      .userOptions({ pks: missing })
      .catch(() => null);
    for (const user of res?.data ?? []) {
      userLabels[String(user.pk)] = user.nickname
        ? `${user.username}-${user.nickname}`
        : user.username;
    }
  };

  watch(
    () => (tableRef.value?.dataList ?? []) as FormDataItem[],
    rows => {
      if (rows.length) collectUserLabels(rows);
    }
  );

  return {
    api,
    auth,
    tableRef,
    forms,
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
