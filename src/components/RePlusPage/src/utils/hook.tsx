import { message } from "@/utils/message";
import type { PageColumn, RePlusPageProps } from "./types";
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
import { useBaseColumns } from "./columns";
import {
  handleExportData,
  handleImportData,
  handleOperation,
  openDialogDrawer,
  renderSwitch
} from "./handle";
import { applyServerErrors } from "./serverErrors";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import {
  formatPublicLabels,
  uniqueArrayObj,
  usePublicHooks
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import DetailDataForm from "../components/DetailData.vue";

import View from "~icons/ep/view";
import Delete from "~icons/ep/delete";
import Upload from "~icons/ep/upload";
import Download from "~icons/ep/download";
import EditPen from "~icons/ep/edit-pen";
import AddFill from "~icons/ri/add-circle-line";
import { handleTree } from "@/utils/tree";

export function usePlusPage(
  emit: (event: string, ...args: unknown[]) => void,
  tableRef: Ref,
  props: RePlusPageProps
) {
  const {
    api,
    auth,
    isTree,
    immediate,
    pagination,
    localeName,
    addOrEditOptions,
    operationButtonsProps,
    tableBarButtonsProps,
    plusDescriptionsProps,
    searchResultFormat,
    listColumnsFormat,
    detailColumnsFormat,
    searchColumnsFormat,
    beforeSearchSubmit,
    baseColumnsFormat,
    allowAsyncExport
  } = props;

  const route = useRoute();
  const { t, te } = useI18n();
  const dataList = ref([]);
  const loadingStatus = ref(false);
  // 显式对齐 @pureadmin/table 的 treeProps 期望形状（其 default 字面量类型三字段全必填）
  const treeProps = ref<{
    hasChildren: string;
    children: string;
    checkStrictly: boolean;
  }>({
    hasChildren: "hasChildren",
    children: "children",
    checkStrictly: isTree ?? false
  });
  const selectedNum = ref(0);
  const defaultValue = ref({});
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const routeParams = isEmpty(route.params) ? route.query : route.params;
  const defaultPagination: RePlusPageProps["pagination"] = {
    total: 0,
    pageSize: 15,
    currentPage: 1,
    pageSizes: [5, 10, 15, 30, 50, 100],
    background: true,
    size: "default"
  };
  if (isTree) {
    defaultPagination.pageSize = 1000;
    defaultPagination.pageSizes = [100, 500, 1000];
  }
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

  const tableBarData = ref({
    size: "default",
    dynamicColumns: listColumns.value,
    renderClass: []
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
      show: (auth.partialUpdate || auth.update) && -30
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
      show: auth.destroy && -20
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
      show: (auth.list || auth.retrieve) && -10
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
      text: computed(() =>
        treeProps.value.checkStrictly
          ? t("buttons.checkUnStrictly")
          : t("buttons.checkStrictly")
      ),
      code: "checkStrictly",
      props: {
        type: "success",
        plain: true
      },
      onClick: () => {
        treeProps.value.checkStrictly = !treeProps.value.checkStrictly;
      },
      show: isTree && -30
    },
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
      show: auth.create && -30
    },
    {
      code: "export",
      props: {
        type: "primary",
        icon: useRenderIcon(Download),
        plain: true
      },
      onClick: () => {
        const pks = getSelectPks();
        handleExportData({
          t,
          pks,
          api,
          searchFields,
          // 未显式设置时按页面导出权限自动显示异步开关（与导出按钮同源判定），
          // 保证所有支持导出的页面都提供大数据量异步导出入口
          allowAsync: allowAsyncExport ?? Boolean(auth.exportData)
        });
      },
      tooltip: { content: t("exportImport.export") },
      show: auth.exportData && -20
    },
    {
      code: "import",
      props: {
        type: "primary",
        icon: useRenderIcon(Upload),
        plain: true
      },
      onClick: () => {
        handleImportData({
          t,
          api,
          success: () => {
            handleGetData();
          }
        });
      },
      tooltip: { content: t("exportImport.import") },
      show: auth.importData && -10
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

  const handleTableBarChange = ({ dynamicColumns, size, renderClass }) => {
    tableBarData.value.dynamicColumns = dynamicColumns;
    tableBarData.value.size = size;
    tableBarData.value.renderClass = renderClass;
    tablePagination.value.size = size;
  };

  const handleReset = () => {
    initSearchFields();
    handleGetData();
  };

  const handleSearch = async () => {
    searchFields.value.page = tablePagination.value.currentPage = 1;
    handleGetData();
  };

  const handleSizeChange = (val: number) => {
    searchFields.value.page = 1;
    searchFields.value.size = val;
    handleGetData();
  };

  const handleFullscreen = () => {
    tableRef.value.setAdaptive();
  };

  const handleCurrentChange = (val: number) => {
    searchFields.value.page = val;
    handleGetData();
  };

  const handleSelectionChange = val => {
    selectedNum.value = val.length;
    emit("selectionChange", tableRef.value.getTableRef().getSelectionRows());
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
  const handleDelete = (row, requestEnd) => {
    handleOperation({
      t,
      apiReq: api.destroy(row?.pk ?? row?.id),
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
      apiReq: api.batchDestroy(getSelectPks("pk")),
      success() {
        onSelectionCancel();
        handleGetData();
      }
    });
  };

  // 查看详情
  const handleDetail = row => {
    openDialogDrawer({
      t,
      title: t("buttons.detail"),
      rawRow: { ...row },
      rawColumns: detailColumns.value,
      dialogDrawerOptions: { width: "60vw", hideFooter: true },
      minWidth: "600px",
      formProps: { ...plusDescriptionsProps },
      form: DetailDataForm
    });
  };

  //新增或编辑
  const handleAddOrEdit = (isAdd = true, row = {}) => {
    let title = t("buttons.edit");
    if (isAdd) {
      title = t("buttons.add");
    }
    openDialogDrawer({
      t,
      isAdd,
      title: `${title} ${addOrEditOptions?.title ?? pageTitle.value}`,
      rawRow: isAdd ? { ...addOrEditDefaultValue.value, ...row } : { ...row },
      form: addOrEditOptions?.form,
      rawColumns: addOrEditColumns.value,
      rawFormProps: {
        rules: addOrEditRules.value
      },
      saveCallback: ({
        formData,
        done,
        closeLoading,
        formRef,
        formOptions
      }) => {
        handleOperation({
          t,
          apiReq:
            (addOrEditOptions?.apiReq &&
              addOrEditOptions?.apiReq({ ...formOptions, formData })) ||
            (isAdd
              ? api.create(formData)
              : api.partialUpdate(formData?.pk ?? formData?.id, formData)),
          success() {
            done();
            handleGetData();
          },
          failed: res => {
            // 业务失败（HTTP 200 + code!=1000）携带的 errors 内联到表单项
            applyServerErrors(formRef, res?.errors);
          },
          exception: err => {
            // 校验失败（HTTP 400，http 层 reject 响应体）携带的 errors 内联到表单项
            applyServerErrors(formRef, err?.errors);
          },
          requestEnd() {
            closeLoading();
          }
        });
      },
      ...addOrEditOptions?.props
    });
  };

  // 表格字段自定义渲染
  const formatColumnsRender = () => {
    listColumns.value.forEach((column: PageColumn) => {
      switch (column._column?.input_type) {
        case "boolean":
          // pure-table ****** start
          column["cellRenderer"] = renderSwitch({
            t,
            updateApi: api.partialUpdate,
            switchLoadMap,
            switchStyle,
            field: column.prop,
            disabled: () => !(auth.partialUpdate || auth.update)
          });
          break;
        // pure-table ****** end
      }
    });
    if (props.selection) {
      listColumns.value.unshift({
        _column: { key: "selection" },
        type: "selection",
        fixed: "left",
        reserveSelection: true
      });
    }
    const hasOperations = uniqueArrayObj(operationButtons.value, "code").filter(
      (item: OperationButtonsRow) => item?.show
    );
    if (props.operation && hasOperations.length > 0) {
      listColumns.value.push({
        _column: { key: "operation" },
        label: formatPublicLabels(t, te, "operation", localeName),
        fixed: "right",
        width: operationButtonsProps?.width ?? 200,
        slot: "operation"
      });
    }
    listColumns.value =
      (listColumnsFormat && listColumnsFormat(listColumns.value)) ||
      listColumns.value;
    detailColumns.value =
      (detailColumnsFormat && detailColumnsFormat(detailColumns.value)) ||
      detailColumns.value;
    searchColumns.value =
      (searchColumnsFormat && searchColumnsFormat(searchColumns.value)) ||
      searchColumns.value;

    if (baseColumnsFormat) {
      baseColumnsFormat({
        listColumns,
        detailColumns,
        searchColumns,
        addOrEditRules,
        addOrEditColumns,
        searchDefaultValue,
        addOrEditDefaultValue
      });
    }
  };

  // 数据获取
  const handleGetData = (
    queryParams = {},
    options: {
      /** 首开内联元数据消费（with_meta=1 响应中的 search_columns/search_fields） */
      inline?: boolean;
      /** 内联响应缺元数据键时的一次性回退（旧后端/无元数据 Action 视图集） */
      onInlineMetaMissing?: () => void;
    } = {}
  ) => {
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

    const params = cloneDeep(toRaw({ ...searchFields.value, ...queryParams }));

    // 该方法为了支持pk多选操作将如下格式 [{pk:1},{pk:2}] 转换为 [1,2]
    Object.keys(params).forEach(key => {
      const value = params[key];
      const pks = [];
      if (isArray(value)) {
        value.forEach(item => {
          if (item.pk ?? item.id) {
            pks.push(item.pk ?? item.id);
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
            dataList.value = isTree
              ? handleTree(res.data.results)
              : res.data.results;
          }
          tablePagination.value.total = res.data.total;
          if (options.inline) {
            if (res.data.search_columns || res.data.search_fields) {
              getColumnData(
                undefined,
                undefined,
                columnsInitCallback,
                fieldsInitCallback,
                {},
                {},
                {
                  search_columns: res.data.search_columns,
                  search_fields: res.data.search_fields
                }
              );
            } else {
              // 旧后端/未混入元数据 Action：回退分离请求
              options.onInlineMetaMissing?.();
            }
          }
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        emit("searchComplete", { routeParams, searchFields, dataList, res });
        delay(500).then(() => {
          loadingStatus.value = false;
        });
      })
      .catch(() => {
        loadingStatus.value = false;
      });
  };

  /** 搜索表单默认值装配（fieldsCallback 与 内联首开共用） */
  const fieldsInitCallback = () => {
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
  };

  /** 元数据格式化（columnsCallback 载荷） */
  const columnsInitCallback = () => {
    formatColumnsRender();
  };

  const getPageColumn = (immediate: boolean) => {
    if (immediate && auth.list && api.list) {
      // 首开以 with_meta=1 合并 list/search-columns/search-fields 三个请求；
      // 响应缺元数据键（旧后端/无元数据 Action）时回退分离请求
      handleGetData(
        { with_meta: 1 },
        {
          inline: true,
          onInlineMetaMissing: () =>
            getColumnData(
              auth.list && api.columns,
              api.fields,
              () => {
                columnsInitCallback();
                if (!api.fields && immediate) {
                  handleGetData();
                }
              },
              () => {
                fieldsInitCallback();
                if (immediate) {
                  handleGetData();
                }
              }
            )
        }
      );
      return;
    }
    getColumnData(
      auth.list && api.columns,
      api.fields,
      () => {
        columnsInitCallback();
        if (!api.fields && immediate) {
          handleGetData();
        }
      },
      () => {
        fieldsInitCallback();
        if (immediate) {
          handleGetData();
        }
      }
    );
  };
  onMounted(() => {
    getPageColumn(immediate);
  });

  return {
    t,
    dataList,
    pageTitle,
    treeProps,
    listColumns,
    selectedNum,
    defaultValue,
    tableBarData,
    searchFields,
    searchColumns,
    loadingStatus,
    tablePagination,
    tableBarButtons,
    operationButtons,
    handleReset,
    handleSearch,
    getSelectPks,
    getPageColumn,
    handleGetData,
    handleAddOrEdit,
    handleManyDelete,
    handleSizeChange,
    handleFullscreen,
    onSelectionCancel,
    handleCurrentChange,
    handleTableBarChange,
    handleSelectionChange
  };
}
