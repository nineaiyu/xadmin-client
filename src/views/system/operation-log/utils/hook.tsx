import dayjs from "dayjs";
import { message } from "@/utils/message";
import { type PaginationProps } from "@pureadmin/table";
import { reactive, ref, onMounted, toRaw, type Ref } from "vue";
import {
  deleteOperationLogApi,
  getOperationLogListApi,
  manyDeleteOperationLogApi
} from "@/api/system/operation";
import { useRouter } from "vue-router";
import { getKeyList } from "@pureadmin/utils";
const sortOptions = [
  { label: "添加时间 Descending", key: "-created_time" },
  { label: "添加时间 Ascending", key: "created_time" }
];
export function useRole(tableRef: Ref) {
  const form = reactive({
    ipaddress: "",
    system: "",
    browser: "",
    path: "",
    owner_id: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const router = useRouter();

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
      label: "日志ID",
      prop: "pk",
      minWidth: 100
    },
    {
      label: "模块名称",
      prop: "module",
      minWidth: 120
    },
    {
      label: "操作人",
      prop: "owner",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoDetail(row as any)}>
          {row.owner.username ? row.owner.username : "/"}
        </el-link>
      )
    },
    {
      label: "IP地址",
      prop: "ipaddress",
      minWidth: 150
    },
    {
      label: "接口地址",
      prop: "path",
      minWidth: 150,
      cellRenderer: ({ row }) => (
        <span>
          {row.method}: {row.path}
        </span>
      )
    },
    {
      label: "请求参数",
      prop: "body",
      minWidth: 150
    },
    {
      label: "请求浏览器",
      prop: "browser",
      minWidth: 150
    },
    {
      label: "请求操作系统",
      prop: "system",
      minWidth: 150
    },
    {
      label: "响应状态码",
      prop: "response_code",
      minWidth: 100
    },
    {
      label: "响应数据",
      prop: "response_result",
      minWidth: 150
    },
    {
      label: "操作时间",
      minWidth: 180,
      prop: "createTime",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: "操作",
      fixed: "right",
      width: 100,
      slot: "operation"
    }
  ];

  function onGoDetail(row: any) {
    if (row.owner && row.owner.pk) {
      router.push({
        name: "systemUser",
        query: { pk: row.owner.pk }
      });
    }
  }
  async function handleDelete(row) {
    deleteOperationLogApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message("操作成功", { type: "success" });
        await onSearch();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
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
      message("数据未选择", { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteOperationLogApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(`批量删除了${manySelectCount.value}条数据`, {
          type: "success"
        });
        await onSearch();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
    });
  }

  async function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    const { data } = await getOperationLogListApi(toRaw(form));
    dataList.value = data.results;
    pagination.total = data.total;

    setTimeout(() => {
      loading.value = false;
    }, 500);
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
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
