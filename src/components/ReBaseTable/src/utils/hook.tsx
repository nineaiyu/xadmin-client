import { message } from "@/utils/message";
import { addDialog } from "@/components/ReDialog";
import type { FormProps, SearchFieldsProps } from "./types";
import { h, onMounted, ref, type Ref, toRaw } from "vue";
import {
  cloneDeep,
  delay,
  deviceDetection,
  getKeyList,
  isEmpty
} from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { useRoute } from "vue-router";
import { formatColumnsLabel, getFieldsData } from "@/views/system/hooks";

export function useBaseTable(
  emit: any,
  tableRef: Ref,
  api: FormProps["api"],
  editForm: FormProps["editForm"],
  tableColumns: FormProps["tableColumns"],
  pagination: FormProps["pagination"],
  resultFormat: FormProps["resultFormat"],
  localeName: FormProps["localeName"]
) {
  const { t, te } = useI18n();
  const formRef = ref();
  const searchFields = ref<SearchFieldsProps>({
    page: 1,
    size: 10,
    ordering: "-created_time"
  });
  const defaultValue = ref({});
  const searchColumns = ref([]);
  const selectedNum = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const showColumns = ref([]);
  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const handleDelete = row => {
    api.delete(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };

  const handleSizeChange = (val: number) => {
    searchFields.value.page = 1;
    searchFields.value.size = val;
    onSearch();
  };

  const handleCurrentChange = (val: number) => {
    searchFields.value.page = val;
    onSearch();
  };

  const handleSelectionChange = val => {
    selectedNum.value = val.length;
    emit("selectionChange", getSelectPks);
  };

  const onSelectionCancel = () => {
    selectedNum.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  };

  const getSelectPks = (key = "pk") => {
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    return getKeyList(manySelectData, key);
  };

  const handleManyDelete = () => {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    api.batchDelete(getSelectPks("pk")).then(res => {
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
  };

  const formatColumns = (results, columns) => {
    if (results.length > 0) {
      showColumns.value = Object.keys(results[0]);
      cloneDeep(columns).forEach(column => {
        if (column?.prop && showColumns.value.indexOf(column?.prop) === -1) {
          columns.splice(
            columns.findIndex(obj => {
              return obj.label === column.label;
            }),
            1
          );
        }
      });
    }
  };

  const onSearch = (init = false) => {
    if (init) {
      pagination.currentPage = searchFields.value.page = 1;
      pagination.pageSize = searchFields.value.size = 10;
    }
    loading.value = true;
    ["created_time", "updated_time"].forEach(key => {
      if (searchFields.value[key]?.length === 2) {
        searchFields.value[`${key}_after`] = searchFields.value[key][0];
        searchFields.value[`${key}_before`] = searchFields.value[key][1];
      } else {
        searchFields.value[`${key}_after`] = "";
        searchFields.value[`${key}_before`] = "";
      }
    });
    api
      .list(toRaw(searchFields.value))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res.data?.results, tableColumns);
          if (resultFormat && typeof resultFormat === "function") {
            dataList.value = resultFormat(res.data.results);
          } else {
            dataList.value = res.data.results;
          }
          pagination.total = res.data.total;
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        emit("searchEnd", getParameter, searchFields, dataList, res);
        delay(500).then(() => {
          loading.value = false;
        });
      })
      .catch(() => {
        loading.value = false;
      });
  };

  const openDialog = (isAdd = true, row = {}) => {
    let title = t("buttons.edit");
    if (isAdd) {
      title = t("buttons.add");
    }
    const rowResult = {};
    Object.keys(editForm?.row ?? {}).forEach(key => {
      const getValue = editForm.row[key];
      if (typeof editForm.row[key] === "function") {
        rowResult[key] = getValue(row, isAdd, dataList.value);
      } else {
        rowResult[key] = getValue;
      }
    });
    const propsResult = {};
    Object.keys(editForm?.props ?? {}).forEach(key => {
      const getValue = editForm.props[key];
      if (typeof editForm.props[key] === "function") {
        propsResult[key] = getValue(row, isAdd, dataList.value);
      } else {
        propsResult[key] = getValue;
      }
    });
    addDialog({
      title: `${title} ${editForm.title ?? ""}`,
      props: {
        formInline: {
          ...row,
          ...rowResult
        },
        ...propsResult,
        showColumns: showColumns.value,
        isAdd: isAdd
      },
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm.form, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline;

        const chores = () => {
          message(t("results.success"), { type: "success" });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        };

        FormRef.validate(valid => {
          if (valid) {
            // todo 接口监测方法
            let apiCreate = api.create;
            if (api.create.length === 3) {
              apiCreate = apiCreate(row, isAdd, curData);
            }
            let apiUpdate = api.update;
            if (api.update.length === 3) {
              apiUpdate = apiUpdate(row, isAdd, curData);
            }
            if (isAdd) {
              apiCreate(curData).then(async res => {
                if (res.code === 1000) {
                  chores();
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              apiUpdate(curData.pk, curData).then(res => {
                if (res.code === 1000) {
                  chores();
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            }
          }
        });
      },
      ...editForm.options
    });
  };
  const onChange = (
    switchLoadMap,
    { row, index },
    actKey,
    msg,
    updateApi = null,
    actMsg = null
  ) => {
    if (!actMsg) {
      actMsg = row[actKey] === false ? t("labels.disable") : t("labels.enable");
    }
    ElMessageBox.confirm(
      `${t("buttons.operateConfirm", {
        action: `<strong>${actMsg}</strong>`,
        message: `<strong style="color:var(--el-color-primary)">${msg}</strong>`
      })}`,
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
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
        if (!updateApi) {
          updateApi = api.update;
        }
        updateApi(row.pk, row).then(res => {
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
        row[actKey] === false ? (row[actKey] = true) : (row[actKey] = false);
      });
  };

  onMounted(() => {
    getFieldsData(api.fields, searchFields, searchColumns, localeName).then(
      () => {
        defaultValue.value = cloneDeep(searchFields.value);
        if (getParameter) {
          const parameter = cloneDeep(getParameter);
          Object.keys(parameter).forEach(param => {
            searchFields.value[param] = parameter[param];
          });
        }
        formatColumnsLabel(tableColumns, t, te, localeName);
        onSearch();
      }
    );
  });

  return {
    t,
    route,
    loading,
    dataList,
    pagination,
    selectedNum,
    showColumns,
    defaultValue,
    searchFields,
    tableColumns,
    searchColumns,
    onChange,
    onSearch,
    openDialog,
    getSelectPks,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
