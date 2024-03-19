import dayjs from "dayjs";
import { message } from "@/utils/message";
import {
  actionInvalidCacheApi,
  createSystemConfigApi,
  deleteSystemConfigApi,
  getSystemConfigListApi,
  manyDeleteSystemConfigApi,
  updateSystemConfigApi
} from "@/api/system/config/system";
import { ElMessageBox } from "element-plus";
import { formatColumns, usePublicHooks } from "@/views/system/hooks";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "./types";
import editForm from "../form.vue";
import type { PaginationProps } from "@pureadmin/table";
import { h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import { delay, deviceDetection, getKeyList } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";

export function useSystemConfig(tableRef: Ref) {
  const { t } = useI18n();
  const sortOptions = [
    {
      label: `${t("sorts.createdDate")} ${t("labels.descending")}`,
      key: "-created_time"
    },
    {
      label: `${t("sorts.createdDate")} ${t("labels.ascending")}`,
      key: "created_time"
    }
  ];
  const form = reactive({
    key: "",
    value: "",
    is_active: "",
    description: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const { switchStyle, tagStyle } = usePublicHooks();
  const showColumns = ref([]);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const columns = ref<TableColumnList>([
    {
      label: t("labels.checkColumn"),
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("configSystem.key"),
      prop: "key",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.key}>{row.key}</span>
    },
    {
      label: t("configSystem.value"),
      prop: "value",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.value}>{row.value}</span>
    },
    {
      label: t("configSystem.cacheValue"),
      prop: "cache_value",
      minWidth: 150,
      cellRenderer: ({ row }) => (
        <span v-copy={row.cache_value.toString()}>
          {row.cache_value.toString()}
        </span>
      )
    },
    {
      label: t("labels.status"),
      prop: "is_active",
      minWidth: 130,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.active")}
          inactive-text={t("labels.inactive")}
          disabled={!hasAuth("update:systemSystemConfig")}
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
      )
    },
    {
      label: t("configSystem.access"),
      prop: "access",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.access)}>
          {row.access ? t("labels.enable") : t("labels.disable")}
        </el-tag>
      )
    },
    {
      label: t("configSystem.inherit"),
      prop: "inherit",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.inherit)}>
          {row.access ? t("labels.enable") : t("labels.disable")}
        </el-tag>
      )
    },
    {
      label: t("labels.description"),
      prop: "description",
      minWidth: 150
    },
    {
      label: t("sorts.createdDate"),
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: t("labels.operations"),
      fixed: "right",
      width: 260,
      slot: "operation",
      hide: !(
        hasAuth("update:systemSystemConfig") ||
        hasAuth("invalid:systemSystemConfig") ||
        hasAuth("delete:systemSystemConfig")
      )
    }
  ]);

  function onChange({ row, index }) {
    const action =
      row.is_active === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style="color:var(--el-color-primary)">${row.key}</strong>`
      })}`,
      {
        confirmButtonText: t("buttons.hssure"),
        cancelButtonText: t("buttons.hscancel"),
        type: "warning",
        dangerouslyUseHTMLString: true,
        draggable: true
      }
    )
      .then(() => {
        switchLoadMap.value[index] = Object.assign(
          {},
          switchLoadMap.value[index],
          {
            loading: true
          }
        );
        updateSystemConfigApi(row.pk, row).then(res => {
          if (res.code === 1000) {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
            message(t("results.success"), { type: "success" });
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          }
        });
      })
      .catch(() => {
        row.is_active === false
          ? (row.is_active = true)
          : (row.is_active = false);
      });
  }

  async function handleDelete(row) {
    deleteSystemConfigApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function handleSizeChange(val: number) {
    form.page = 1;
    form.size = val;
    await onSearch();
  }

  async function handleCurrentChange(val: number) {
    form.page = val;
    await onSearch();
  }

  function handleSelectionChange(val) {
    manySelectCount.value = val.length;
  }

  function onSelectionCancel() {
    manySelectCount.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  function handleManyDelete() {
    if (manySelectCount.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteSystemConfigApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: manySelectCount.value }), {
          type: "success"
        });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    const { data } = await getSystemConfigListApi(toRaw(form)).catch(() => {
      loading.value = false;
    });
    formatColumns(data?.results, columns, showColumns);
    dataList.value = data.results;
    pagination.total = data.total;
    delay(500).then(() => {
      loading.value = false;
    });
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  function openDialog(is_add = true, row?: FormItemProps) {
    let title = t("buttons.hsedit");
    if (is_add) {
      title = t("buttons.hsadd");
    }
    addDialog({
      title: `${title} ${t("configSystem.configSystem")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          key: row?.key ?? "",
          value: row?.value ?? "",
          is_active: row?.is_active ?? true,
          inherit: row?.inherit ?? false,
          access: row?.access ?? false,
          description: row?.description ?? ""
        },
        showColumns: showColumns.value,
        isAdd: is_add
      },
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;

        async function chores(detail) {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          await onSearch(); // 刷新表格数据
        }

        FormRef.validate(valid => {
          if (valid) {
            if (is_add) {
              createSystemConfigApi(curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateSystemConfigApi(curData.pk, curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            }
          }
        });
      }
    });
  }

  const handleInvalidCache = row => {
    actionInvalidCacheApi(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };

  onMounted(() => {
    onSearch();
  });

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    pagination,
    sortOptions,
    manySelectCount,
    onSelectionCancel,
    onSearch,
    resetForm,
    openDialog,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleInvalidCache,
    handleCurrentChange,
    handleSelectionChange
  };
}
