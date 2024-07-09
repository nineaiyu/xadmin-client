import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import { reactive, ref, type Ref, shallowRef } from "vue";
import { usePublicHooks } from "@/views/system/hooks";
import { userConfigApi } from "@/api/system/config/user";

import { renderOption, renderSwitch } from "@/views/system/render";

export function useUserConfig(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive({
    list: userConfigApi.list,
    create: userConfigApi.create,
    delete: userConfigApi.delete,
    update: userConfigApi.patch,
    invalid: userConfigApi.invalid,
    fields: userConfigApi.fields,
    import: userConfigApi.import,
    export: userConfigApi.export,
    batchDelete: userConfigApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemUserConfig"),
    create: hasAuth("create:systemUserConfig"),
    delete: hasAuth("delete:systemUserConfig"),
    update: hasAuth("update:systemUserConfig"),
    invalid: hasAuth("invalid:systemUserConfig"),
    import: hasAuth("import:systemUserConfig"),
    export: hasAuth("export:systemUserConfig"),
    batchDelete: hasAuth("batchDelete:systemUserConfig")
  });

  const editForm = shallowRef({
    title: t("configUser.configUser"),
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
    },
    formProps: {
      rules: {
        config_user: [
          {
            required: true,
            message: t("configUser.config_user"),
            trigger: "blur"
          }
        ],
        key: [
          {
            required: true,
            message: t("configUser.key"),
            trigger: "blur"
          }
        ],
        value: [
          {
            required: true,
            message: t("configUser.value"),
            trigger: "blur"
          }
        ]
      }
    },
    columns: ({ isAdd }) => {
      return [
        {
          prop: "config_user",
          valueType: "select",
          hideInForm: !hasGlobalAuth("list:systemUser"),
          fieldProps: {
            disabled: !isAdd,
            multiple: true
          },
          renderField: (value, onChange) => {
            return (
              <SearchUsers
                modelValue={value}
                disabled={!isAdd}
                onChange={onChange}
              />
            );
          }
        },
        {
          prop: "key",
          valueType: "input"
        },
        {
          prop: "value",
          valueType: "textarea",
          fieldProps: {
            autosize: {
              minRows: 8
            }
          }
        },
        {
          prop: "access",
          valueType: "radio",
          colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
          tooltip: t("configSystem.accessTip"),
          renderField: renderOption()
        },
        {
          prop: "is_active",
          valueType: "radio",
          colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
          renderField: renderOption()
        },
        {
          prop: "description",
          valueType: "textarea"
        }
      ];
    }
  });

  const router = useRouter();
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
      prop: "owner",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoUserDetail(row as any)}>
          {row.owner?.username ? row.owner?.username : "/"}
        </el-link>
      )
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
        scope.row.config_user = [scope.row.owner];
        return scope.row.key;
      })
    },
    {
      prop: "access",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props?.size} style={tagStyle.value(row.access)}>
          {row.access ? t("labels.enable") : t("labels.disable")}
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

  const onGoUserDetail = (row: any) => {
    if (hasGlobalAuth("list:systemUser") && row.owner && row.owner?.pk) {
      router.push({
        name: "SystemUser",
        query: { pk: row.owner.pk }
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
    handleInvalidCache
  };
}
