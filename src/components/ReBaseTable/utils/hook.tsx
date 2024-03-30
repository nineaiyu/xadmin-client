import { message } from "@/utils/message";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "./types";
import type { PaginationProps } from "@pureadmin/table";
import { h, onMounted, ref, type Ref, toRaw } from "vue";
import {
  cloneDeep,
  delay,
  deviceDetection,
  getKeyList
} from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";

export function useBaseTable(
  tableRef: Ref,
  api,
  editForm,
  tableColumns,
  pagination: PaginationProps | {},
  searchForm
) {
  const { t } = useI18n();
  const switchLoadMap = ref({});
  const formRef = ref();
  const selectedNum = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const showColumns = ref([]);
  const defaultPagination = {
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  };

  Object.keys(defaultPagination).forEach(key => {
    pagination[key] || (pagination[key] = defaultPagination[key]);
  });

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
    searchForm.page = 1;
    searchForm.size = val;
    onSearch();
  };

  const handleCurrentChange = (val: number) => {
    searchForm.page = val;
    onSearch();
  };

  const handleSelectionChange = val => {
    selectedNum.value = val.length;
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
    api
      .batchDelete({
        pks: JSON.stringify(getSelectPks("pk"))
      })
      .then(res => {
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
      pagination.currentPage = searchForm.page = 1;
      pagination.pageSize = searchForm.size = 10;
    }
    loading.value = true;
    api
      .list(toRaw(searchForm))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res.data?.results, tableColumns);
          dataList.value = res.data.results;
          pagination.total = res.data.total;
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
  };

  const openDialog = (isAdd = true, row = {}) => {
    let title = t("buttons.edit");
    if (isAdd) {
      title = t("buttons.add");
    }
    const result = {};
    Object.keys(editForm.row).forEach(key => {
      if (typeof editForm.row[key] === "function") {
        const getValue = editForm.row[key];
        result[key] = getValue(row, isAdd);
      }
    });
    addDialog({
      title: `${title} ${t("configSystem.configSystem")}`,
      props: {
        formInline: {
          ...row,
          ...editForm.row,
          ...result
        },
        ...editForm.props,
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
        const curData = options.props.formInline as FormItemProps;

        const chores = detail => {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        };

        FormRef.validate(valid => {
          if (valid) {
            if (isAdd) {
              api.create(curData).then(async res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              api.update(curData.pk, curData).then(res => {
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
      },
      ...editForm.options
    });
  };
  const onChange = ({ row, index }, actKey, msg, actMsg = null) => {
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
        api.update(row.pk, row).then(res => {
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
    onSearch();
  });

  return {
    t,
    loading,
    dataList,
    searchForm,
    pagination,
    selectedNum,
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
