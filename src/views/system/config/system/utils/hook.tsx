import dayjs from "dayjs";
import Form from "../form.vue";
import { useI18n } from "vue-i18n";
import { systemConfigApi } from "@/api/system/config/system";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type { PlusColumn } from "plus-pro-components";
import { reactive, ref, type Ref, shallowRef } from "vue";
import { formatFormColumns, usePublicHooks } from "@/views/system/hooks";
import { renderOption, renderSwitch } from "@/views/system/render";

export function useSystemConfig(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive({
    list: systemConfigApi.list,
    create: systemConfigApi.create,
    delete: systemConfigApi.delete,
    update: systemConfigApi.patch,
    invalid: systemConfigApi.invalid,
    fields: systemConfigApi.fields,
    batchDelete: systemConfigApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemSystemConfig"),
    create: hasAuth("create:systemSystemConfig"),
    delete: hasAuth("delete:systemSystemConfig"),
    update: hasAuth("update:systemSystemConfig"),
    invalid: hasAuth("invalid:systemSystemConfig"),
    fields: hasAuth("fields:systemSystemConfig"),
    batchDelete: hasAuth("batchDelete:systemSystemConfig")
  });

  const editForm = shallowRef({
    title: t("configSystem.configSystem"),
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

  const { tagStyle } = usePublicHooks();
  const columns = ref<TableColumnList>([
    {
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      prop: "pk",
      minWidth: 100
    },
    {
      prop: "key",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.key}>{row.key}</span>
    },
    {
      prop: "value",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.value}>{row.value}</span>
    },
    {
      prop: "cache_value",
      minWidth: 150,
      cellRenderer: ({ row }) => (
        <span v-copy={row.cache_value.toString()}>
          {row.cache_value.toString()}
        </span>
      )
    },
    {
      prop: "is_active",
      minWidth: 130,
      cellRenderer: renderSwitch(auth.update, tableRef, "is_active", scope => {
        return scope.row.key;
      })
    },
    {
      prop: "access",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.access)}>
          {row.access ? t("labels.enable") : t("labels.disable")}
        </el-tag>
      )
    },
    {
      prop: "inherit",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.inherit)}>
          {row.inherit ? t("labels.enable") : t("labels.disable")}
        </el-tag>
      )
    },
    {
      prop: "description",
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
      width: 260,
      slot: "operation",
      hide: !(auth.update || auth.delete || auth.invalid)
    }
  ]);

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
    handleInvalidCache
  };
}

export function useSystemConfigForm(props) {
  const { t, te } = useI18n();
  const columns: PlusColumn[] = [
    {
      prop: "key",
      valueType: "input"
    },
    {
      prop: "value",
      valueType: "textarea"
    },
    {
      prop: "access",
      valueType: "radio",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
      tooltip: t("configSystem.accessTip"),
      renderField: renderOption()
    },
    {
      prop: "inherit",
      valueType: "radio",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
      tooltip: t("configSystem.inheritTip"),
      renderField: renderOption()
    },
    {
      prop: "is_active",
      valueType: "radio",
      renderField: renderOption()
    },
    {
      prop: "description",
      valueType: "textarea"
    }
  ];
  formatFormColumns(props, columns, t, te, "configSystem");
  return {
    t,
    columns
  };
}
