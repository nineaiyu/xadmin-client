import dayjs from "dayjs";
import Form from "../form.vue";
import {
  actionInvalidCacheApi,
  createUserConfigApi,
  deleteUserConfigApi,
  getUserConfigListApi,
  manyDeleteUserConfigApi,
  updateUserConfigApi
} from "@/api/system/config/user";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { cloneDeep } from "@pureadmin/utils";
import type { PlusColumn } from "plus-pro-components";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import { computed, reactive, ref, type Ref, shallowRef } from "vue";
import { formatOptions, usePublicHooks } from "@/views/system/hooks";
import {
  disableState,
  renderOption,
  renderSwitch,
  selectOptions
} from "@/views/system/render";

export function useUserConfig(tableRef: Ref) {
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
  const searchField = ref({
    key: "",
    value: "",
    is_active: "",
    username: "",
    owner_id: "",
    description: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const defaultValue = cloneDeep(searchField.value);

  const api = reactive({
    list: getUserConfigListApi,
    create: createUserConfigApi,
    delete: deleteUserConfigApi,
    update: updateUserConfigApi,
    invalid: actionInvalidCacheApi,
    batchDelete: manyDeleteUserConfigApi
  });

  const auth = reactive({
    list: hasAuth("list:systemUserConfig"),
    create: hasAuth("create:systemUserConfig"),
    delete: hasAuth("delete:systemUserConfig"),
    update: hasAuth("update:systemUserConfig"),
    invalid: hasAuth("invalid:systemUserConfig"),
    batchDelete: hasAuth("manyDelete:systemUserConfig")
  });

  const editForm = shallowRef({
    title: t("configUser.configUser"),
    form: Form,
    row: {
      config_user: row => {
        return row?.owner ? [row?.owner] : [];
      },
      is_active: row => {
        return row?.is_active ?? true;
      },
      access: row => {
        return row?.access ?? false;
      }
    }
  });

  const router = useRouter();
  const { tagStyle } = usePublicHooks();

  const columns = ref<TableColumnList>([
    {
      label: t("labels.checkColumn"),
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("user.userInfo"),
      prop: "owner_info",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoUserDetail(row as any)}>
          {row.owner_info?.username ? row.owner_info?.username : "/"}
        </el-link>
      )
    },
    {
      label: t("configUser.key"),
      prop: "key",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.key}>{row.key}</span>
    },
    {
      label: t("configUser.value"),
      prop: "value",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.value}>{row.value}</span>
    },
    {
      label: t("configUser.cacheValue"),
      prop: "cache_value",
      minWidth: 150,
      cellRenderer: ({ row }) => (
        <span v-copy={row.cache_value.toString()}>
          {row.cache_value.toString()}
        </span>
      )
    },
    {
      label: t("labels.status"),
      prop: "is_active",
      minWidth: 130,
      cellRenderer: renderSwitch(auth.update, tableRef, "is_active", scope => {
        scope.row.config_user = [scope.row.owner];
        return scope.row.key;
      })
    },
    {
      label: t("configSystem.access"),
      prop: "access",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props?.size} style={tagStyle.value(row.access)}>
          {row.access ? t("labels.enable") : t("labels.disable")}
        </el-tag>
      )
    },
    {
      label: t("labels.description"),
      prop: "description",
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
      width: 260,
      slot: "operation",
      hide: !(auth.update || auth.delete || auth.invalid)
    }
  ]);
  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("user.username"),
        prop: "username",
        valueType: "input"
      },
      {
        label: t("configUser.key"),
        prop: "key",
        valueType: "input"
      },
      {
        label: t("configUser.value"),
        prop: "value",
        valueType: "input"
      },
      {
        label: t("labels.description"),
        prop: "description",
        valueType: "input"
      },
      {
        label: t("labels.status"),
        prop: "is_active",
        valueType: "select",
        options: selectOptions
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });

  const onGoUserDetail = (row: any) => {
    if (
      hasGlobalAuth("list:systemUser") &&
      row.owner_info &&
      row.owner_info?.pk
    ) {
      router.push({
        name: "SystemUser",
        query: { pk: row.owner_info.pk }
      });
    }
  };

  const handleInvalidCache = row => {
    api.invalid(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        tableRef.value.onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };

  return {
    t,
    api,
    auth,
    columns,
    editForm,
    searchField,
    defaultValue,
    searchColumns,
    handleInvalidCache
  };
}

export function useUserConfigForm(props) {
  const { t } = useI18n();
  const columns: PlusColumn[] = [
    {
      label: t("user.userId"),
      prop: "config_user",
      valueType: "select",
      hideInForm: !hasGlobalAuth("list:systemUser"),
      fieldProps: {
        disabled: !props?.isAdd,
        multiple: true
      },
      renderField: value => {
        return <SearchUsers modelValue={value} disabled={!props.isAdd} />;
      }
    },
    {
      label: t("configUser.key"),
      prop: "key",
      valueType: "input",
      fieldProps: {
        disabled: disableState(props, "key")
      }
    },
    {
      label: t("configUser.value"),
      prop: "value",
      valueType: "textarea",
      fieldProps: {
        autosize: { minRows: 5, maxRows: 20 },
        disabled: disableState(props, "value")
      }
    },
    {
      label: t("configSystem.access"),
      prop: "access",
      valueType: "radio",
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 12,
        xl: 12
      },
      tooltip: t("configSystem.accessTip"),
      fieldProps: {
        disabled: disableState(props, "access")
      },
      renderField: renderOption()
    },
    {
      label: t("labels.status"),
      prop: "is_active",
      valueType: "radio",
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 12,
        xl: 12
      },
      tooltip: t("labels.status"),
      renderField: renderOption()
    },
    {
      label: t("labels.description"),
      prop: "description",
      valueType: "textarea",
      fieldProps: {
        disabled: disableState(props, "description")
      }
    }
  ];

  return {
    t,
    columns
  };
}
