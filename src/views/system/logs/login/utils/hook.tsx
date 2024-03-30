import dayjs from "dayjs";
import { computed, onMounted, reactive, ref } from "vue";
import {
  deleteLoginLogApi,
  getLoginLogDetailApi,
  getLoginLogListApi,
  manyDeleteLoginLogApi
} from "@/api/system/logs/login";
import { useRouter } from "vue-router";
import { cloneDeep } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { formatOptions, usePublicHooks } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";
import { getPickerShortcuts } from "@/views/system/logs/utils";

export function useLoginLog() {
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
    agent: "",
    creator_id: "",
    login_type: "",
    created_time: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const defaultValue = cloneDeep(searchForm.value);
  const api = reactive({
    list: getLoginLogListApi,
    delete: deleteLoginLogApi,
    detail: getLoginLogDetailApi,
    batchDelete: manyDeleteLoginLogApi
  });

  const auth = reactive({
    list: hasAuth("list:systemLoginLog"),
    delete: hasAuth("delete:systemLoginLog"),
    batchDelete: hasAuth("manyDelete:systemLoginLog")
  });

  const router = useRouter();
  const choicesDict = ref({});
  const { tagStyle } = usePublicHooks();

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
        options: formatOptions(choicesDict.value["login_type"])
      },
      {
        label: t("sorts.loginDate"),
        prop: "created_time",
        valueType: "date-picker",
        colProps: {
          xs: 24,
          sm: 24,
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

  onMounted(() => {
    api.detail("choices").then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });
  });

  return {
    api,
    auth,
    columns,
    searchForm,
    defaultValue,
    searchColumns
  };
}
