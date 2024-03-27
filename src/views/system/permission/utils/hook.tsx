import dayjs from "dayjs";
import { message } from "@/utils/message";
import {
  createDataPermissionApi,
  deleteDataPermissionApi,
  getDataPermissionListApi,
  manyDeleteDataPermissionApi,
  updateDataPermissionApi
} from "@/api/system/permission";
import { ElMessageBox } from "element-plus";
import {
  formatColumns,
  formatOptions,
  usePublicHooks
} from "@/views/system/hooks";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "./types";
import editForm from "../form.vue";
import type { PaginationProps } from "@pureadmin/table";
import { computed, h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import { delay, deviceDetection, getKeyList } from "@pureadmin/utils";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { FieldChoices, ModeChoices } from "@/views/system/constants";
import { handleTree } from "@/utils/tree";
import { getModelLabelFieldListApi } from "@/api/system/field";
import { getMenuPermissionListApi } from "@/api/system/menu";
import type { PlusColumn } from "plus-pro-components";

export function useDataPermission(tableRef: Ref) {
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
  const form = ref({
    name: "",
    mode_type: "",
    is_active: "",
    description: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const selectedNum = ref(0);
  const dataList = ref([]);
  const fieldLookupsData = ref([]);
  const menuPermissionData = ref([]);
  const choicesDict = ref([]);
  const valuesData = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
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
      label: t("permission.name"),
      prop: "name",
      minWidth: 120
    },
    {
      label: t("permission.mode"),
      prop: "mode_display",
      minWidth: 120
    },
    {
      label: t("labels.status"),
      minWidth: 130,
      prop: "is_active",
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.active")}
          inactive-text={t("labels.inactive")}
          disabled={!hasAuth("update:systemDataPermission")}
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
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
      width: 160,
      slot: "operation"
    }
  ]);

  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("permission.name"),
        prop: "name",
        valueType: "input"
      },
      {
        label: t("labels.status"),
        prop: "is_active",
        valueType: "select",
        options: [
          {
            label: t("labels.disable"),
            value: false
          },
          {
            label: t("labels.enable"),
            value: true
          }
        ]
      },
      {
        label: t("permission.mode"),
        prop: "mode_type",
        valueType: "select",
        options: formatOptions(choicesDict.value)
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });

  function onChange({ row, index }) {
    const action =
      row.is_active === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style="color:var(--el-color-primary)">${row.name}</strong>`
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
        updateDataPermissionApi(row.pk, row).then(res => {
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

  function handleDelete(row) {
    deleteDataPermissionApi(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function handleSizeChange(val: number) {
    form.value.page = 1;
    form.value.size = val;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    form.value.page = val;
    onSearch();
  }

  function handleSelectionChange(val) {
    selectedNum.value = val.length;
  }

  function onSelectionCancel() {
    selectedNum.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  function handleManyDelete() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteDataPermissionApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: selectedNum.value }), {
          type: "success"
        });
        onSelectionCancel();
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.value.page = 1;
      pagination.pageSize = form.value.size = 10;
    }
    loading.value = true;
    getDataPermissionListApi(toRaw(form.value))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res?.data?.results, columns, showColumns);
          dataList.value = res.data.results;
          pagination.total = res.data.total;
          choicesDict.value = res.choices_dict;
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        delay(500).then(() => {
          loading.value = false;
        });
      })
      .catch(() => {
        loading.value = false;
      });
  }

  function openDialog(isAdd = true, row?: FormItemProps) {
    let title = t("buttons.hsedit");
    if (isAdd) {
      title = t("buttons.hsadd");
    }
    addDialog({
      title: `${title} ${t("permission.permission")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          name: row?.name ?? "",
          menu: row?.menu ?? [],
          rules: row?.rules ?? [],
          mode_type: row?.mode_type ?? ModeChoices.OR,
          is_active: row?.is_active ?? true,
          description: row?.description ?? ""
        },
        menuPermissionData: menuPermissionData.value,
        fieldLookupsData: fieldLookupsData.value,
        valuesData: valuesData.value,
        choicesDict: choicesDict.value,
        showColumns: showColumns.value,
        isAdd: isAdd
      },
      width: "50%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      top: "10vh",
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;

        function chores(detail) {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        }

        FormRef.validate(valid => {
          if (valid) {
            if (curData.rules.length === 0) {
              message(`${t("permission.rulesFailed")}`, {
                type: "error"
              });
              return;
            }
            if (isAdd) {
              createDataPermissionApi(curData).then(async res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateDataPermissionApi(curData.pk, curData).then(async res => {
                if (res.code === 1000) {
                  chores(res.detail);
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

  onMounted(() => {
    onSearch();
    if (hasGlobalAuth("list:systemModelField")) {
      getModelLabelFieldListApi({
        page: 1,
        size: 1000,
        field_type: FieldChoices.DATA
      }).then(res => {
        if (res.code === 1000) {
          fieldLookupsData.value = handleTree(res.data.results);
          valuesData.value = res.choices_dict;
        }
      });
    }
    if (hasGlobalAuth("list:systemMenuPermission")) {
      getMenuPermissionListApi({ page: 1, size: 1000 }).then(res => {
        if (res.code === 1000) {
          menuPermissionData.value = handleTree(res.data.results);
        }
      });
    }
  });

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    pagination,
    selectedNum,
    searchColumns,
    onSearch,
    openDialog,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
