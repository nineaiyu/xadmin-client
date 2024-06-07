import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { loginLogApi } from "@/api/system/logs/login";
import { useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { reactive, ref } from "vue";
import { usePublicHooks } from "@/views/system/hooks";

export function useLoginLog() {
  const { t } = useI18n();
  const api = reactive({
    list: loginLogApi.list,
    delete: loginLogApi.delete,
    fields: loginLogApi.fields,
    export: loginLogApi.export,
    batchDelete: loginLogApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemLoginLog"),
    delete: hasAuth("delete:systemLoginLog"),
    fields: hasAuth("fields:systemLoginLog"),
    export: hasAuth("export:systemLoginLog"),
    batchDelete: hasAuth("batchDelete:systemLoginLog")
  });

  const router = useRouter();
  const { tagStyle } = usePublicHooks();

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
      prop: "login_type.label",
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
      prop: "agent",
      minWidth: 150
    },
    {
      prop: "status",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.status)}>
          {row.status ? t("labels.success") : t("labels.failed")}
        </el-tag>
      )
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
    columns
  };
}
