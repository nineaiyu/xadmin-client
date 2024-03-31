import dayjs from "dayjs";
import Form from "../form.vue";
import { useI18n } from "vue-i18n";
import {
  actionInvalidCacheApi,
  createSystemConfigApi,
  deleteSystemConfigApi,
  getSystemConfigListApi,
  manyDeleteSystemConfigApi,
  updateSystemConfigApi
} from "@/api/system/config/system";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { cloneDeep } from "@pureadmin/utils";
import type { PlusColumn } from "plus-pro-components";
import { computed, reactive, ref, type Ref, shallowRef } from "vue";
import { formatOptions, usePublicHooks } from "@/views/system/hooks";
import {
  disableState,
  renderOption,
  renderSwitch,
  selectOptions
} from "@/views/system/render";

export function useSystemConfig(tableRef: Ref) {
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
    key: "",
    value: "",
    is_active: "",
    description: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const defaultValue = cloneDeep(searchForm.value);

  const api = reactive({
    list: getSystemConfigListApi,
    create: createSystemConfigApi,
    delete: deleteSystemConfigApi,
    update: updateSystemConfigApi,
    invalid: actionInvalidCacheApi,
    batchDelete: manyDeleteSystemConfigApi
  });

  const auth = reactive({
    list: hasAuth("list:systemSystemConfig"),
    create: hasAuth("create:systemSystemConfig"),
    delete: hasAuth("delete:systemSystemConfig"),
    update: hasAuth("update:systemSystemConfig"),
    invalid: hasAuth("invalid:systemSystemConfig"),
    batchDelete: hasAuth("manyDelete:systemSystemConfig")
  });

  const editForm = shallowRef({
    form: Form,
    row: {
      is_active: row => {
        return row?.is_active ?? true;
      },
      access: row => {
        return row?.access ?? false;
      },
      inherit: row => {
        return row?.inherit ?? false;
      }
    }
  });

  const { switchStyle, tagStyle } = usePublicHooks();
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
      label: t("configSystem.key"),
      prop: "key",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.key}>{row.key}</span>
    },
    {
      label: t("configSystem.value"),
      prop: "value",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.value}>{row.value}</span>
    },
    {
      label: t("configSystem.cacheValue"),
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
      cellRenderer: renderSwitch(
        auth,
        tableRef,
        switchStyle,
        "is_active",
        scope => {
          return scope.row.key;
        }
      )
    },
    {
      label: t("configSystem.access"),
      prop: "access",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.access)}>
          {row.access ? t("labels.enable") : t("labels.disable")}
        </el-tag>
      )
    },
    {
      label: t("configSystem.inherit"),
      prop: "inherit",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.inherit)}>
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
        label: t("configSystem.key"),
        prop: "key",
        valueType: "input"
      },
      {
        label: t("configSystem.value"),
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
    searchForm,
    defaultValue,
    searchColumns,
    handleInvalidCache
  };
}

export function useSystemConfigForm(props) {
  const { t } = useI18n();
  const columns: PlusColumn[] = [
    {
      label: t("configSystem.key"),
      prop: "key",
      valueType: "input",
      fieldProps: {
        disabled: disableState(props, "key")
      }
    },
    {
      label: t("configSystem.value"),
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
      label: t("configSystem.inherit"),
      prop: "inherit",
      valueType: "radio",
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 12,
        xl: 12
      },
      tooltip: t("configSystem.inheritTip"),
      fieldProps: {
        disabled: disableState(props, "inherit")
      },
      renderField: renderOption()
    },
    {
      label: t("labels.status"),
      prop: "is_active",
      valueType: "radio",
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
