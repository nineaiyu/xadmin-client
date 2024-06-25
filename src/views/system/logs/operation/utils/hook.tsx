import dayjs from "dayjs";
import { operationLogApi } from "@/api/system/logs/operation";
import { useRouter } from "vue-router";
import { reactive, ref } from "vue";
import { hasAuth, hasGlobalAuth } from "@/router/utils";

export function useOperationLog() {
  const api = reactive({
    list: operationLogApi.list,
    delete: operationLogApi.delete,
    fields: operationLogApi.fields,
    export: operationLogApi.export,
    batchDelete: operationLogApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemOperationLog"),
    delete: hasAuth("delete:systemOperationLog"),
    export: hasAuth("export:systemOperationLog"),
    batchDelete: hasAuth("batchDelete:systemOperationLog")
  });

  const router = useRouter();
  const pagination = reactive({
    total: 0,
    pageSize: 20,
    currentPage: 1,
    pageSizes: [20, 30, 100, 200],
    background: true
  });
  const columns = ref<TableColumnList>([
    {
      type: "selection",
      fixed: "left",
      reserveSelection: true,
      hide: !auth.delete
    },
    {
      prop: "pk",
      minWidth: 100
    },
    {
      prop: "module",
      minWidth: 120
    },
    {
      prop: "creator",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoDetail(row as any)}>
          {row.creator?.username ? row.creator?.username : "/"}
        </el-link>
      )
    },
    {
      prop: "ipaddress",
      minWidth: 150
    },
    {
      prop: "path",
      minWidth: 150,
      cellRenderer: ({ row }) => (
        <span>
          {row.method}: {row.path}
        </span>
      )
    },
    {
      prop: "body",
      minWidth: 150
    },
    {
      prop: "browser",
      minWidth: 150
    },
    {
      prop: "system",
      minWidth: 150
    },
    {
      prop: "response_code",
      minWidth: 100
    },
    {
      prop: "response_result",
      minWidth: 150
    },
    {
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      fixed: "right",
      width: 100,
      slot: "operation",
      hide: !auth.delete
    }
  ]);

  function onGoDetail(row: any) {
    if (hasGlobalAuth("list:systemUser") && row?.creator && row?.creator?.pk) {
      router.push({
        name: "SystemUser",
        query: { pk: row.creator.pk }
      });
    }
  }

  return {
    api,
    auth,
    columns,
    pagination
  };
}
