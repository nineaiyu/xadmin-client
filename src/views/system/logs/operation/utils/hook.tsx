import dayjs from "dayjs";
import { computed, reactive, ref } from "vue";
import {
  deleteOperationLogApi,
  getOperationLogListApi,
  manyDeleteOperationLogApi
} from "@/api/system/logs/operation";
import { useRouter } from "vue-router";
import { cloneDeep } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";
import { getPickerShortcuts } from "@/views/system/logs/utils";

export function useOperationLog() {
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
  const searchForm = ref({
    ipaddress: "",
    system: "",
    browser: "",
    path: "",
    creator_id: "",
    created_time: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const defaultValue = cloneDeep(searchForm.value);
  const api = reactive({
    list: getOperationLogListApi,
    delete: deleteOperationLogApi,
    batchDelete: manyDeleteOperationLogApi
  });

  const auth = reactive({
    list: hasAuth("list:systemOperationLog"),
    delete: hasAuth("delete:systemOperationLog"),
    batchDelete: hasAuth("manyDelete:systemOperationLog")
  });

  const router = useRouter();

  const columns = ref<TableColumnList>([
    {
      label: t("labels.checkColumn"),
      type: "selection",
      fixed: "left",
      reserveSelection: true,
      hide: !auth.delete
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
      hide: !auth.delete
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
        prop: "created_time",
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

  return {
    api,
    auth,
    columns,
    searchForm,
    defaultValue,
    searchColumns
  };
}
