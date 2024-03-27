import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { computed, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import {
  deleteOperationLogApi,
  getOperationLogListApi,
  manyDeleteOperationLogApi
} from "@/api/system/logs/operation";
import { useRouter } from "vue-router";
import { delay, getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { formatColumns, formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";
import { getPickerShortcuts } from "@/views/system/logs/utils";

export function useOperationLog(tableRef: Ref) {
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
    loginTime: "",
    ipaddress: "",
    system: "",
    browser: "",
    path: "",
    creator_id: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const router = useRouter();
  const selectedNum = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
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
      reserveSelection: true,
      hide: !hasAuth("delete:systemOperationLog")
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("logsOperation.module"),
      prop: "module",
      minWidth: 120
    },
    {
      label: t("user.user"),
      prop: "creator",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoDetail(row as any)}>
          {row.creator?.username ? row.creator?.username : "/"}
        </el-link>
      )
    },
    {
      label: t("logsOperation.address"),
      prop: "ipaddress",
      minWidth: 150
    },
    {
      label: t("logsOperation.requestPath"),
      prop: "path",
      minWidth: 150,
      cellRenderer: ({ row }) => (
        <span>
          {row.method}: {row.path}
        </span>
      )
    },
    {
      label: t("logsOperation.parameters"),
      prop: "body",
      minWidth: 150
    },
    {
      label: t("logsOperation.browser"),
      prop: "browser",
      minWidth: 150
    },
    {
      label: t("logsOperation.system"),
      prop: "system",
      minWidth: 150
    },
    {
      label: t("logsOperation.statusCode"),
      prop: "response_code",
      minWidth: 100
    },
    {
      label: t("logsOperation.response"),
      prop: "response_result",
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
      width: 100,
      slot: "operation",
      hide: !hasAuth("delete:systemOperationLog")
    }
  ]);

  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("user.userId"),
        prop: "owner_id",
        valueType: "input",
        fieldProps: {
          placeholder: t("user.verifyUserId")
        }
      },
      {
        label: t("logsOperation.address"),
        prop: "ipaddress",
        valueType: "input",
        fieldProps: {
          placeholder: t("logsOperation.verifyAddress")
        }
      },
      {
        label: t("logsOperation.system"),
        prop: "system",
        valueType: "input",
        fieldProps: {
          placeholder: t("logsOperation.verifySystem")
        }
      },
      {
        label: t("logsOperation.browser"),
        prop: "browser",
        valueType: "input",
        fieldProps: {
          placeholder: t("logsOperation.verifyBrowser")
        }
      },
      {
        label: t("logsOperation.requestPath"),
        prop: "path",
        valueType: "input",
        fieldProps: {
          placeholder: t("logsOperation.verifyRequestPath")
        }
      },
      {
        label: t("sorts.createdDate"),
        prop: "loginTime",
        valueType: "date-picker",
        colProps: {
          xs: 24,
          sm: 12,
          md: 8,
          lg: 8,
          xl: 8
        },
        fieldProps: {
          shortcuts: getPickerShortcuts(),
          valueFormat: "YYYY-MM-DD HH:mm:ss",
          type: "datetimerange"
        }
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });
  function onGoDetail(row: any) {
    if (hasGlobalAuth("list:systemUser") && row.creator && row.creator?.pk) {
      router.push({
        name: "SystemUser",
        query: { pk: row.creator.pk }
      });
    }
  }

  function handleDelete(row) {
    deleteOperationLogApi(row.pk).then(res => {
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
    manyDeleteOperationLogApi({
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
    if (form.value.loginTime && form.value.loginTime.length === 2) {
      form.value.created_time_after = form.value.loginTime[0];
      form.value.created_time_before = form.value.loginTime[1];
    }
    getOperationLogListApi(toRaw(form.value))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res.data?.results, columns, showColumns);
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
  }

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
    selectedNum,
    searchColumns,
    onSearch,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
