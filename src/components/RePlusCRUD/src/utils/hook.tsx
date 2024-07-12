import { message } from "@/utils/message";
import type { PlusPageProps } from "./types";
import { computed, onMounted, ref, type Ref, shallowRef, toRaw } from "vue";
import {
  cloneDeep,
  delay,
  getKeyList,
  isArray,
  isEmpty
} from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import exportDataForm from "../components/exportData.vue";
import importDataForm from "../components/importData.vue";
import detailDataForm from "../components/detailData.vue";
import { resourcesIDCacheApi } from "@/api/common";
import { useBaseColumns } from "./columns";
import {
  renderSwitch,
  handleOperation,
  openFormDialog,
  type operationOptions
} from "./handle";
import { usePublicHooks } from "@/views/system/hooks";
import { formatPublicLabels } from "@/components/RePlusCRUD";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import EditPen from "@iconify-icons/ep/edit-pen";
import Delete from "@iconify-icons/ep/delete";
import View from "@iconify-icons/ep/view";
import type { OperationButtonsRow } from "../components/buttonOperation/types";
import AddFill from "@iconify-icons/ri/add-circle-line";
import Download from "@iconify-icons/ep/download";
import Upload from "@iconify-icons/ep/upload";

export function useBaseTable(
  emit: any,
  tableRef: Ref,
  api: PlusPageProps["api"],
  pagination: PlusPageProps["pagination"],
  localeName: PlusPageProps["localeName"],
  resultFormat: PlusPageProps["resultFormat"],
  addOrEditOptions: PlusPageProps["addOrEditOptions"],
  beforeSearchSubmit: PlusPageProps["beforeSearchSubmit"]
) {
  const { t, te } = useI18n();
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();

  const {
    listColumns,
    showColumns,
    searchColumns,
    getColumnData,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  } = useBaseColumns(localeName);

  const searchFields = ref({
    size: pagination.pageSize,
    page: pagination.currentPage
  });
  const defaultValue = ref({});
  const selectedNum = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;

  const pageTitle = computed(() => {
    if (te(route.meta.title)) {
      return t(route.meta.title);
    }
    return route.meta.title;
  });

  // 默认操作按钮
  const operationButtons = shallowRef<OperationButtonsRow[]>([]);
  operationButtons.value = [
    {
      text: t("buttons.edit"),
      code: "update",
      props: {
        type: "primary",
        icon: useRenderIcon(EditPen),
        link: true
      },
      onClick: ({ row }) => {
        handleAddOrEdit(false, row);
      },
      show: true
    },
    {
      text: t("buttons.delete"),
      code: "delete",
      confirm: { title: t("buttons.confirmDelete") },
      props: {
        type: "danger",
        icon: useRenderIcon(Delete),
        link: true
      },
      onClick: ({ row }) => {
        handleDelete(row);
      },
      show: true
    },
    {
      code: "detail",
      props: {
        type: "primary",
        icon: useRenderIcon(View),
        link: true
      },
      onClick: ({ row }) => {
        handleDetail(row);
      },
      tooltip: { content: t("buttons.detail") },
      show: true
    }
  ];

  // 默认tableBar按钮
  const tableBarButtons = shallowRef<OperationButtonsRow[]>([]);

  tableBarButtons.value = [
    {
      text: t("buttons.add"),
      code: "create",
      props: {
        type: "primary",
        icon: useRenderIcon(AddFill)
      },
      onClick: ({ row }) => {
        handleAddOrEdit(true, row);
      },
      show: true
    },
    {
      code: "export",
      props: {
        type: "primary",
        icon: useRenderIcon(Download),
        plain: true
      },
      onClick: () => {
        exportData();
      },
      tooltip: { content: t("exportImport.export") },
      show: true
    },
    {
      code: "import",
      props: {
        type: "primary",
        icon: useRenderIcon(Upload),
        plain: true
      },
      onClick: () => {
        importData();
      },
      tooltip: { content: t("exportImport.import") },
      show: true
    }
  ];

  const initSearchFields = () => {
    searchFields.value = cloneDeep(defaultValue.value);
    pagination.pageSize = searchFields.value.size;
    pagination.currentPage = searchFields.value.page;
  };

  const handleReset = () => {
    initSearchFields();
    handleGetData();
  };

  // 数据获取
  const handleGetData = () => {
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

    const params = cloneDeep(toRaw(searchFields.value));

    // 该方法为了支持pk多选操作将如下格式 [{pk:1},{pk:2}] 转换为 [1,2]
    Object.keys(params).forEach(key => {
      const value = params[key];
      const pks = [];
      if (isArray(value)) {
        value.forEach(item => {
          if (item.pk) {
            pks.push(item.pk);
          }
        });
        if (pks.length > 0) {
          params[key] = pks;
        }
      }
    });

    const data = (beforeSearchSubmit && beforeSearchSubmit(params)) || params;

    api
      .list(data)
      .then(res => {
        if (res.code === 1000 && res.data) {
          if (resultFormat && typeof resultFormat === "function") {
            dataList.value = resultFormat(res.data.results);
          } else {
            dataList.value = res.data.results;
          }
          pagination.total = res.data.total;
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        emit("searchComplete", getParameter, searchFields, dataList, res);
        delay(500).then(() => {
          loading.value = false;
        });
      })
      .catch(() => {
        loading.value = false;
      });
  };

  const handleSearch = () => {
    searchFields.value.page = pagination.currentPage = 1;
    handleGetData();
  };

  const handleSizeChange = (val: number) => {
    searchFields.value.page = 1;
    searchFields.value.size = val;
    handleGetData();
  };

  const handleCurrentChange = (val: number) => {
    searchFields.value.page = val;
    handleGetData();
  };

  const handleSelectionChange = val => {
    selectedNum.value = val.length;
    emit("selectionChange", getSelectPks);
  };

  const onSelectionCancel = () => {
    selectedNum.value = 0;
    tableRef.value.getTableRef().clearSelection();
  };

  const getSelectPks = (key = "pk") => {
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    return getKeyList(manySelectData, key);
  };

  // 删除
  const handleDelete = (row: operationOptions["row"]) => {
    handleOperation({
      t,
      row,
      apiUrl: api.delete,
      success() {
        handleGetData();
      }
    });
  };

  // 批量删除
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
        handleGetData();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };

  // 查看详情
  const handleDetail = row => {
    openFormDialog({
      t,
      title: t("buttons.detail"),
      row: { ...row },
      columns: showColumns.value,
      dialogOptions: { width: "600px", hideFooter: true },
      form: detailDataForm
    });
  };

  // 数据导出
  function exportData() {
    const pks = getSelectPks();

    openFormDialog({
      t,
      title: t("exportImport.export"),
      row: {
        type: "xlsx",
        range: pks.length > 0 ? "selected" : "all",
        pks: pks
      },
      dialogOptions: { width: "600px" },
      form: exportDataForm,
      saveCallback: async ({ formData, done }) => {
        if (formData.range === "all") {
          await api.export(formData);
        } else if (formData.range === "search") {
          // 暂时不支持查询导出
          searchFields.value["type"] = formData["type"];
          await api.export(toRaw(searchFields.value));
        } else if (formData.range === "selected") {
          resourcesIDCacheApi(formData.pks).then(async res => {
            formData["spm"] = res.spm;
            delete formData.pks;
            await api.export(formData);
          });
        }
        done();
      }
    });
  }

  // 数据导入
  function importData() {
    openFormDialog({
      t,
      title: t("exportImport.import"),
      row: {
        action: "create",
        api: api
      },
      dialogOptions: { width: "600px" },
      form: importDataForm,
      saveCallback: ({ formData, success, failed }) => {
        api.import(formData.action, formData.upload[0].raw).then(res => {
          if (res.code === 1000) {
            handleGetData(); // 刷新表格数据
            success();
          } else {
            failed(res.detail, false);
          }
        });
      }
    });
  }

  //新增或编辑
  const handleAddOrEdit = (isAdd = true, row = {}) => {
    let title = t("buttons.edit");
    if (isAdd) {
      title = t("buttons.add");
    }
    openFormDialog({
      t,
      title: `${title} ${addOrEditOptions?.title ?? pageTitle.value}`,
      row: isAdd ? { ...addOrEditDefaultValue.value } : { ...row },
      form: addOrEditOptions?.form,
      columns: addOrEditColumns.value,
      formProps: {
        rules: addOrEditRules.value
      },
      saveCallback: ({ formData, done }) => {
        let apiUrl: any = api.update;
        if (isAdd) {
          apiUrl = api.create;
        }
        if (apiUrl.length === 3) {
          apiUrl = apiUrl(row, isAdd, formData);
        }
        handleOperation({
          t,
          apiUrl,
          row: formData,
          success() {
            done();
            handleGetData();
          }
        });
      },
      ...addOrEditOptions?.props
    });
  };

  // 表格字段自定义渲染
  const formatColumnsRender = () => {
    listColumns.value.forEach(column => {
      switch (column.valueType) {
        case "switch":
          // pure-table ******
          column["cellRenderer"] = renderSwitch({
            t,
            updateApi: api.patch,
            switchLoadMap,
            switchStyle,
            field: column.prop
          });
          break;
      }
    });
    listColumns.value.unshift({
      type: "selection",
      fixed: "left",
      reserveSelection: true
    });
    listColumns.value.push({
      label: formatPublicLabels(t, te, "operation", localeName),
      fixed: "right",
      width: 200,
      slot: "operation"
    });
  };

  onMounted(() => {
    getColumnData(
      api,
      () => {
        formatColumnsRender();
      },
      () => {
        defaultValue.value = {
          ...{
            page: pagination.currentPage,
            size: pagination.pageSize,
            ordering: "-created_time"
          },
          ...searchDefaultValue.value
        };
        searchFields.value = cloneDeep(defaultValue.value);

        if (getParameter) {
          const parameter = cloneDeep(getParameter);
          Object.keys(parameter).forEach(param => {
            searchFields.value[param] = parameter[param];
          });
        }
        handleGetData();
      }
    );
  });

  return {
    t,
    loading,
    dataList,
    pageTitle,
    pagination,
    listColumns,
    selectedNum,
    defaultValue,
    searchFields,
    searchColumns,
    tableBarButtons,
    operationButtons,
    handleReset,
    handleSearch,
    getSelectPks,
    handleGetData,
    handleManyDelete,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
