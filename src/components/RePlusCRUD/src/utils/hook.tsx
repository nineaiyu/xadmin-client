import { message } from "@/utils/message";
import type { RePlusPageProps } from "./types";
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
import { resourcesIDCacheApi } from "@/api/common";
import { type CRUDColumn, useBaseColumns } from "./columns";
import {
  renderSwitch,
  handleOperation,
  openFormDialog,
  type operationOptions
} from "./handle";
import {
  formatPublicLabels,
  uniqueArrayObj,
  usePublicHooks
} from "@/components/RePlusCRUD";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { OperationButtonsRow } from "@/components/RePlusCRUD";
import exportDataForm from "../components/exportData.vue";
import importDataForm from "../components/importData.vue";
import detailDataForm from "../components/detailData.vue";

import View from "@iconify-icons/ep/view";
import Delete from "@iconify-icons/ep/delete";
import Upload from "@iconify-icons/ep/upload";
import Download from "@iconify-icons/ep/download";
import EditPen from "@iconify-icons/ep/edit-pen";
import AddFill from "@iconify-icons/ri/add-circle-line";

export function useBaseTable(emit: any, tableRef: Ref, props: RePlusPageProps) {
  const {
    api,
    auth,
    pagination,
    localeName,
    addOrEditOptions,
    operationButtonsProps,
    tableBarButtonsProps,
    searchResultFormat,
    listColumnsFormat,
    detailColumnsFormat,
    searchColumnsFormat,
    beforeSearchSubmit,
    baseColumnsFormat
  } = props;

  const route = useRoute();
  const { t, te } = useI18n();
  const dataList = ref([]);
  const loadingStatus = ref(true);
  const selectedNum = ref(0);
  const defaultValue = ref({});
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const routeParams = isEmpty(route.params) ? route.query : route.params;
  const defaultPagination = {
    total: 0,
    pageSize: 15,
    currentPage: 1,
    pageSizes: [5, 10, 15, 30, 50, 100],
    background: true
  };
  const tablePagination = ref<RePlusPageProps["pagination"]>({
    ...defaultPagination,
    ...pagination
  });
  const {
    listColumns,
    detailColumns,
    searchColumns,
    getColumnData,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  } = useBaseColumns(localeName);
  const searchFields = ref({
    size: tablePagination.value.pageSize,
    page: tablePagination.value.currentPage
  });

  const pageTitle = computed(() => {
    if (te(route.meta.title)) {
      return t(route.meta.title);
    }
    return route.meta.title;
  });

  // 默认操作按钮
  const defaultOperationButtons = shallowRef<OperationButtonsRow[]>([]);
  defaultOperationButtons.value = [
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
      show: auth.patch || auth.update
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
      onClick: ({ row, loading }) => {
        loading.value = true;
        handleDelete(row, () => {
          loading.value = false;
        });
      },
      show: auth.delete
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
      show: auth.list || auth.detail
    }
  ];

  const operationButtons = computed(() => {
    return [
      ...defaultOperationButtons.value,
      ...(operationButtonsProps?.buttons ?? [])
    ];
  });
  // 默认tableBar按钮
  const defaultTableBarButtons = shallowRef<OperationButtonsRow[]>([]);

  defaultTableBarButtons.value = [
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
      show: auth.create
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
      show: auth.export
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
      show: auth.import
    }
  ];

  const tableBarButtons = computed(() => {
    return [
      ...defaultTableBarButtons.value,
      ...(tableBarButtonsProps?.buttons ?? [])
    ];
  });

  const initSearchFields = () => {
    searchFields.value = cloneDeep(defaultValue.value);
    tablePagination.value.pageSize = searchFields.value.size;
    tablePagination.value.currentPage = searchFields.value.page;
  };

  const handleReset = () => {
    initSearchFields();
    handleGetData();
  };

  const handleSearch = () => {
    searchFields.value.page = tablePagination.value.currentPage = 1;
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
  const handleDelete = (row: operationOptions["row"], requestEnd) => {
    handleOperation({
      t,
      row,
      apiUrl: api.delete,
      success() {
        handleGetData();
      },
      requestEnd
    });
  };

  // 批量删除
  const handleManyDelete = () => {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }

    handleOperation({
      t,
      row: getSelectPks("pk") as object,
      apiUrl: api.batchDelete,
      showSuccessMsg: false,
      success() {
        message(t("results.batchDelete", { count: selectedNum.value }), {
          type: "success"
        });
        onSelectionCancel();
        handleGetData();
      }
    });
  };

  // 查看详情
  const handleDetail = row => {
    openFormDialog({
      t,
      title: t("buttons.detail"),
      rawRow: { ...row },
      rawColumns: detailColumns.value,
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
      rawRow: {
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
      rawRow: {
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
      isAdd,
      title: `${title} ${addOrEditOptions?.title ?? pageTitle.value}`,
      rawRow: isAdd ? { ...addOrEditDefaultValue.value, ...row } : { ...row },
      form: addOrEditOptions?.form,
      rawColumns: addOrEditColumns.value,
      formProps: {
        rules: addOrEditRules.value
      },
      saveCallback: ({ formData, done, dialogOptions }) => {
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
          },
          requestEnd() {
            dialogOptions.confirmLoading = false;
          }
        });
      },
      ...addOrEditOptions?.props
    });
  };

  // 表格字段自定义渲染
  const formatColumnsRender = () => {
    listColumns.value.forEach((column: CRUDColumn) => {
      switch (column._column?.input_type) {
        case "boolean":
          // pure-table ****** start
          column["cellRenderer"] = renderSwitch({
            t,
            updateApi: api.patch,
            switchLoadMap,
            switchStyle,
            field: column.prop,
            disabled: !(auth.patch || auth.update)
          });
          break;
        // pure-table ****** end
      }
    });
    props.selection &&
      listColumns.value.unshift({
        _column: { key: "selection" },
        type: "selection",
        fixed: "left",
        reserveSelection: true
      });
    const hasOperations = uniqueArrayObj(operationButtons.value, "code").filter(
      (item: OperationButtonsRow) => item?.show
    );
    props.operation &&
      hasOperations.length > 0 &&
      listColumns.value.push({
        _column: { key: "operation" },
        label: formatPublicLabels(t, te, "operation", localeName),
        fixed: "right",
        width: operationButtonsProps?.width ?? 200,
        slot: "operation"
      });
    listColumns.value =
      (listColumnsFormat && listColumnsFormat(listColumns.value)) ||
      listColumns.value;
    detailColumns.value =
      (detailColumnsFormat && detailColumnsFormat(detailColumns.value)) ||
      detailColumns.value;
    searchColumns.value =
      (searchColumnsFormat && searchColumnsFormat(searchColumns.value)) ||
      searchColumns.value;

    baseColumnsFormat &&
      baseColumnsFormat({
        listColumns,
        detailColumns,
        searchColumns,
        addOrEditRules,
        addOrEditColumns,
        searchDefaultValue,
        addOrEditDefaultValue
      });
  };

  // 数据获取
  const handleGetData = () => {
    loadingStatus.value = true;

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
          if (searchResultFormat && typeof searchResultFormat === "function") {
            dataList.value = searchResultFormat(res.data.results);
          } else {
            dataList.value = res.data.results;
          }
          tablePagination.value.total = res.data.total;
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        emit("searchComplete", routeParams, searchFields, dataList, res);
        delay(500).then(() => {
          loadingStatus.value = false;
        });
      })
      .catch(() => {
        loadingStatus.value = false;
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
            page: tablePagination.value.currentPage,
            size: tablePagination.value.pageSize,
            ordering: "-created_time"
          },
          ...searchDefaultValue.value
        };
        searchFields.value = cloneDeep(defaultValue.value);

        if (routeParams) {
          const parameter = cloneDeep(routeParams);
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
    dataList,
    pageTitle,
    listColumns,
    selectedNum,
    defaultValue,
    searchFields,
    searchColumns,
    loadingStatus,
    tablePagination,
    tableBarButtons,
    operationButtons,
    handleReset,
    handleSearch,
    getSelectPks,
    handleGetData,
    handleAddOrEdit,
    handleManyDelete,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
