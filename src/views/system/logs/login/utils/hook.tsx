import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { onMounted, reactive, ref, type Ref, toRaw } from "vue";
import {
  deleteLoginLogApi,
  getLoginLogListApi,
  manyDeleteLoginLogApi
} from "@/api/system/logs/login";
import { useRouter } from "vue-router";
import { delay, getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { hasAuth, hasGlobalAuth } from "@/router/utils";

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
  const form = reactive({
    ipaddress: "",
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
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const columns: TableColumnList = [
    {
      type: "selection",
      align: "left"
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
      label: t("sorts.createdDate"),
      minWidth: 180,
      prop: "createTime",
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
  ];

  function onGoDetail(row: any) {
    if (hasGlobalAuth("list:systemUser") && row.creator && row.creator?.pk) {
      router.push({
        name: "systemUser",
        query: { pk: row.creator.pk }
      });
    }
  }

  async function handleDelete(row) {
    deleteLoginLogApi(row.pk).then(async res => {
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
    manyDeleteLoginLogApi({
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
    const { data, choices_dict } = await getLoginLogListApi(toRaw(form));
    dataList.value = data.results;
    pagination.total = data.total;
    choicesDict.value = choices_dict;
    delay(500).then(() => {
      loading.value = false;
    });
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
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
    choicesDict,
    manySelectCount,
    onSelectionCancel,
    onSearch,
    resetForm,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
