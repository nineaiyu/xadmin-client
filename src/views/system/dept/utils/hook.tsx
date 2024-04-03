import dayjs from "dayjs";
import { message } from "@/utils/message";
import {
  createDeptApi,
  deleteDeptApi,
  empowerDeptRoleApi,
  getDeptDetailApi,
  getDeptListApi,
  manyDeleteDeptApi,
  updateDeptApi
} from "@/api/system/dept";
import {
  computed,
  h,
  onMounted,
  reactive,
  ref,
  type Ref,
  shallowRef
} from "vue";
import { addDialog } from "@/components/ReDialog";
import roleForm from "../form/role.vue";
import Form from "../form/index.vue";
import type { RoleFormItemProps } from "./types";
import { getRoleListApi } from "@/api/system/role";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { formatHigherDeptOptions, formatOptions } from "@/views/system/hooks";
import { getDataPermissionListApi } from "@/api/system/permission";
import { ModeChoices } from "@/views/system/constants";
import type { PlusColumn } from "plus-pro-components";

import {
  disableState,
  renderOption,
  renderSwitch,
  selectOptions
} from "@/views/system/render";
import { handleTree } from "@/utils/tree";

export function useDept(tableRef: Ref) {
  const { t } = useI18n();
  const sortOptions = [
    {
      label: `${t("sorts.createdDate")} ${t("labels.descending")}`,
      key: "-created_time"
    },
    {
      label: `${t("sorts.createdDate")} ${t("labels.ascending")}`,
      key: "created_time"
    },
    {
      label: `${t("sorts.rank")} ${t("labels.descending")}`,
      key: "-rank"
    },
    {
      label: `${t("sorts.rank")} ${t("labels.ascending")}`,
      key: "rank"
    }
  ];
  const searchField = ref({
    pk: "",
    name: "",
    code: "",
    mode_type: "",
    auto_bind: "",
    description: "",
    is_active: "",
    ordering: sortOptions[3].key,
    page: 1,
    size: 1000
  });

  const defaultValue = cloneDeep(searchField.value);

  const api = reactive({
    list: getDeptListApi,
    create: createDeptApi,
    delete: deleteDeptApi,
    update: updateDeptApi,
    empower: empowerDeptRoleApi,
    detail: getDeptDetailApi,
    batchDelete: manyDeleteDeptApi
  });

  const auth = reactive({
    list: hasAuth("list:systemDept"),
    create: hasAuth("create:systemDept"),
    delete: hasAuth("delete:systemDept"),
    update: hasAuth("update:systemDept"),
    empower: hasAuth("empower:systemDeptRole"),
    detail: hasAuth("detail:systemDept"),
    batchDelete: hasAuth("manyDelete:systemDept")
  });

  const editForm = shallowRef({
    title: t("dept.dept"),
    form: Form,
    row: {
      roles: row => {
        return row?.roles ?? [];
      },
      is_active: row => {
        return row?.is_active ?? true;
      },
      auto_bind: row => {
        return row?.auto_bind ?? false;
      },
      rank: row => {
        return row?.rank ?? 99;
      }
    },
    props: {
      treeData: (row, isAdd, data) => {
        return formatHigherDeptOptions(cloneDeep(data));
      }
    }
  });

  const router = useRouter();
  const rolesOptions = ref([]);
  const rulesOptions = ref([]);
  const choicesDict = ref([]);
  const columns = ref<TableColumnList>([
    {
      label: t("labels.checkColumn"),
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      label: t("dept.name"),
      prop: "name",
      minWidth: 200,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100,
      cellRenderer: ({ row }) => <span v-copy={row.pk}>{row.pk}</span>
    },
    {
      label: t("dept.code"),
      prop: "code",
      minWidth: 100,
      cellRenderer: ({ row }) => <span v-copy={row.code}>{row.code}</span>
    },
    {
      label: t("dept.userCount"),
      prop: "user_count",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoDetail(row as any)}>
          {row.user_count}
        </el-link>
      )
    },
    {
      label: t("sorts.rank"),
      prop: "rank",
      minWidth: 90
    },
    {
      label: t("permission.mode"),
      prop: "mode_display",
      minWidth: 90
    },
    {
      label: t("dept.autoBind"),
      minWidth: 130,
      prop: "auto_bind",
      cellRenderer: renderSwitch(auth.update, tableRef, "auto_bind", scope => {
        return `${scope.row.name} ${t("dept.autoBind")}`;
      })
    },
    {
      label: t("labels.status"),
      prop: "is_active",
      minWidth: 90,
      cellRenderer: renderSwitch(auth.update, tableRef, "is_active", scope => {
        return scope.row.name;
      })
    },
    {
      label: t("dept.roles"),
      prop: "roles_info",
      width: 160,
      slot: "roles"
    },
    {
      label: t("dept.rules"),
      prop: "rules_info",
      width: 160,
      slot: "rules"
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
      width: 180,
      slot: "operation",
      hide: !(
        hasAuth("update:systemDept") ||
        hasAuth("empower:systemDeptRole") ||
        hasAuth("delete:systemDept")
      )
    }
  ]);
  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("labels.id"),
        prop: "pk",
        valueType: "input"
      },
      {
        label: t("dept.name"),
        prop: "name",
        valueType: "input"
      },
      {
        label: t("dept.code"),
        prop: "code",
        valueType: "input"
      },
      {
        label: t("labels.description"),
        prop: "description",
        valueType: "input"
      },
      {
        label: t("dept.autoBind"),
        prop: "auto_bind",
        valueType: "select",
        options: selectOptions
      },
      {
        label: t("labels.status"),
        prop: "is_active",
        valueType: "select",
        options: selectOptions
      },
      {
        label: t("permission.mode"),
        prop: "mode_type",
        valueType: "select",
        options: computed(() => {
          return formatOptions(choicesDict.value["mode_type"]);
        })
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
    if (hasGlobalAuth("list:systemUser") && row.user_count && row.pk) {
      router.push({
        name: "SystemUser",
        query: { dept: row.pk }
      });
    }
  }

  const buttonClass = computed(() => {
    return [
      "!h-[20px]",
      "reset-margin",
      "!text-gray-500",
      "dark:!text-white",
      "dark:hover:!text-primary"
    ];
  });

  /** 分配角色 */
  function handleRole(row) {
    addDialog({
      title: t("dept.assignRole", { dept: row.name }),
      props: {
        formInline: {
          name: row?.name ?? "",
          code: row?.code ?? "",
          mode_type: row?.mode_type ?? ModeChoices.AND,
          ids: row?.roles ?? [],
          pks: row?.rules ?? []
        },
        rolesOptions: rolesOptions.value ?? [],
        rulesOptions: rulesOptions.value ?? [],
        choicesDict: choicesDict.value["mode_type"] ?? []
      },
      width: "600px",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(roleForm),
      beforeSure: (done, { options }) => {
        const curData = options.props.formInline as RoleFormItemProps;
        api
          .empower(row.pk, {
            roles: curData.ids,
            rules: curData.pks,
            mode_type: curData.mode_type
          })
          .then(res => {
            if (res.code === 1000) {
              message(t("results.success"), { type: "success" });
              tableRef.value.onSearch();
            } else {
              message(`${t("results.failed")}，${res.detail}`, {
                type: "error"
              });
            }
            done(); // 关闭弹框
          });
      }
    });
  }

  onMounted(() => {
    api.detail("choices").then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });

    if (hasGlobalAuth("list:systemRole")) {
      getRoleListApi({ page: 1, size: 1000 }).then(res => {
        if (res.code === 1000 && res.data) {
          rolesOptions.value = res.data.results;
        }
      });
    }
    if (hasGlobalAuth("list:systemDataPermission")) {
      getDataPermissionListApi({
        page: 1,
        size: 1000
      }).then(res => {
        if (res.code === 1000 && res.data) {
          rulesOptions.value = res.data.results;
        }
      });
    }
  });

  const formatResult = data => {
    return handleTree(data);
  };

  return {
    t,
    api,
    auth,
    columns,
    editForm,
    searchField,
    buttonClass,
    defaultValue,
    searchColumns,
    handleRole,
    formatResult
  };
}

export function useDeptForm(props) {
  const { t } = useI18n();
  const columns: PlusColumn[] = [
    {
      label: t("dept.name"),
      prop: "name",
      valueType: "input",
      fieldProps: {
        disabled: disableState(props, "name")
      },
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 12,
        xl: 12
      }
    },
    {
      label: t("dept.code"),
      prop: "code",
      valueType: "input",
      fieldProps: {
        disabled: disableState(props, "code")
      },
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 12,
        xl: 12
      }
    },
    {
      label: t("menu.parentNode"),
      prop: "parent",
      valueType: "cascader",
      fieldProps: {
        disabled: disableState(props, "parent"),
        props: {
          value: "pk",
          label: "name",
          emitPath: false,
          checkStrictly: true
        }
      },
      options: props.treeData
    },
    {
      label: t("sorts.rank"),
      prop: "rank",
      valueType: "input-number",
      fieldProps: {
        disabled: disableState(props, "rank")
      },
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 12,
        xl: 12
      }
    },
    {
      label: t("dept.autoBind"),
      prop: "auto_bind",
      valueType: "radio",
      colProps: {
        xs: 24,
        sm: 24,
        md: 24,
        lg: 12,
        xl: 12
      },
      tooltip: t("dept.autoBindDesc"),
      fieldProps: {
        disabled: disableState(props, "auto_bind")
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

export function useRoleForm(props) {
  const { t } = useI18n();
  const customOptions = (data: Array<any>) => {
    const result = [];
    data?.forEach(item => {
      result.push({
        label: item?.name,
        value: item?.pk,
        fieldSlot: () => {
          return (
            <>
              <span style="float: left">{item.name}</span>
              <span
                style="
                  float: right;
                  font-size: 13px;
                  color: var(--el-text-color-secondary);
                "
              >
                {item.code ?? item.mode_display}
              </span>
            </>
          );
        }
      });
    });
    return result;
  };
  const columns: PlusColumn[] = [
    {
      label: t("dept.name"),
      prop: "name",
      valueType: "input",
      fieldProps: {
        disabled: true
      }
    },
    {
      label: t("dept.code"),
      prop: "code",
      valueType: "input",
      fieldProps: {
        disabled: true
      }
    },
    {
      label: t("dept.roles"),
      prop: "ids",
      valueType: "select",
      fieldProps: {
        multiple: true
      },
      options: customOptions(props.rolesOptions)
    },
    {
      label: t("permission.mode"),
      prop: "mode_type",
      valueType: "select",
      options: formatOptions(props.choicesDict)
    },
    {
      label: t("dept.rules"),
      prop: "pks",
      valueType: "select",
      fieldProps: {
        multiple: true
      },
      options: customOptions(props.rulesOptions)
    }
  ];
  return {
    t,
    columns
  };
}
