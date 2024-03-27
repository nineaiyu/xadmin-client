import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { computed, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import {
  deleteLoginLogApi,
  getLoginLogListApi,
  manyDeleteLoginLogApi
} from "@/api/system/logs/login";
import { useRouter } from "vue-router";
import { delay, getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import {
  formatColumns,
  formatOptions,
  usePublicHooks
} from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";
import { getPickerShortcuts } from "@/views/system/logs/utils";

export function useLoginLog(tableRef: Ref) {
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
    ipaddress: "",
    loginTime: "",
    system: "",
    browser: "",
    agent: "",
    creator_id: "",
    login_type: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const router = useRouter();
  const choicesDict = ref([]);
  const selectedNum = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const showColumns = ref([]);
  const { tagStyle } = usePublicHooks();

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
      hide: !hasAuth("delete:systemLoginLog")
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
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
      label: t("logsLogin.address"),
      prop: "ipaddress",
      minWidth: 150
    },
    {
      label: t("logsLogin.loginDisplay"),
      prop: "login_display",
      minWidth: 150
    },
    {
      label: t("logsLogin.browser"),
      prop: "browser",
      minWidth: 150
    },
    {
      label: t("logsLogin.system"),
      prop: "system",
      minWidth: 150
    },
    {
      label: t("logsLogin.agent"),
      prop: "agent",
      minWidth: 150
    },
    {
      label: t("labels.status"),
      prop: "status",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.status)}>
          {row.status ? t("labels.success") : t("labels.failed")}
        </el-tag>
      )
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
      hide: !hasAuth("delete:systemLoginLog")
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
        label: t("logsLogin.address"),
        prop: "ipaddress",
        valueType: "input",
        fieldProps: {
          placeholder: t("logsLogin.verifyAddress")
        }
      },
      {
        label: t("logsLogin.system"),
        prop: "system",
        valueType: "input",
        fieldProps: {
          placeholder: t("logsLogin.verifySystem")
        }
      },
      {
        label: t("logsLogin.browser"),
        prop: "browser",
        valueType: "input",
        fieldProps: {
          placeholder: t("logsLogin.verifyBrowser")
        }
      },
      {
        label: t("logsLogin.agent"),
        prop: "agent",
        valueType: "input",
        fieldProps: {
          placeholder: t("logsLogin.verifyAgent")
        }
      },
      {
        label: t("logsLogin.loginDisplay"),
        prop: "login_type",
        valueType: "select",
        options: formatOptions(choicesDict.value)
      },
      {
        label: t("sorts.loginDate"),
        prop: "loginTime",
        valueType: "date-picker",
        colProps: {
          xs: 24,
          sm: 12,
          md: 12,
          lg: 12,
          xl: 12
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
    deleteLoginLogApi(row.pk).then(res => {
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
    manyDeleteLoginLogApi({
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
    getLoginLogListApi(toRaw(form.value))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res.data?.results, columns, showColumns);
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
    choicesDict,
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
