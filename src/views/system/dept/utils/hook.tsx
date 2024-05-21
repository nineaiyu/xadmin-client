import dayjs from "dayjs";
import { message } from "@/utils/message";
import { deptApi } from "@/api/system/dept";
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
import leaderForm from "../form/leader.vue";
import Form from "../form/index.vue";
import type { LeaderFormItemProps, RoleFormItemProps } from "./types";
import { roleApi } from "@/api/system/role";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import {
  formatFormColumns,
  formatHigherDeptOptions,
  formatOptions
} from "@/views/system/hooks";
import { dataPermissionApi } from "@/api/system/permission";
import { ModeChoices } from "@/views/system/constants";
import type { PlusColumn } from "plus-pro-components";

import { renderOption, renderSwitch } from "@/views/system/render";
import { handleTree } from "@/utils/tree";
import SearchUsers from "@/views/system/base/searchUsers.vue";

export function useDept(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive({
    list: deptApi.list,
    create: deptApi.create,
    delete: deptApi.delete,
    update: deptApi.patch,
    empower: deptApi.empower,
    leader: deptApi.leader,
    choices: deptApi.choices,
    fields: deptApi.fields,
    batchDelete: deptApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemDept"),
    create: hasAuth("create:systemDept"),
    delete: hasAuth("delete:systemDept"),
    update: hasAuth("update:systemDept"),
    empower: hasAuth("empower:systemDept"),
    leader: hasAuth("leader:systemDept"),
    choices: hasAuth("choices:systemDept"),
    fields: hasAuth("fields:systemDept"),
    batchDelete: hasAuth("batchDelete:systemDept")
  });

  const editForm = shallowRef({
    title: t("systemDept.dept"),
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
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      prop: "name",
      minWidth: 200,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      prop: "pk",
      minWidth: 100,
      cellRenderer: ({ row }) => <span v-copy={row.pk}>{row.pk}</span>
    },
    {
      prop: "code",
      minWidth: 100,
      cellRenderer: ({ row }) => <span v-copy={row.code}>{row.code}</span>
    },
    {
      prop: "user_count",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoDetail(row as any)}>
          {row.user_count}
        </el-link>
      )
    },
    {
      prop: "rank",
      minWidth: 90
    },
    {
      prop: "mode_type.label",
      minWidth: 90
    },
    {
      minWidth: 130,
      prop: "auto_bind",
      cellRenderer: renderSwitch(auth.update, tableRef, "auto_bind", scope => {
        return `${scope.row.name} ${t("systemDept.auto_bind")}`;
      })
    },
    {
      prop: "is_active",
      minWidth: 90,
      cellRenderer: renderSwitch(auth.update, tableRef, "is_active", scope => {
        return scope.row.name;
      })
    },
    {
      prop: "roles_info",
      width: 160,
      slot: "roles"
    },
    {
      prop: "rules_info",
      width: 160,
      slot: "rules"
    },
    {
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      fixed: "right",
      width: 180,
      slot: "operation",
      hide: !(auth.update || auth.empower || auth.delete)
    }
  ]);

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
      title: t("systemDept.assignRole", { dept: row.name }),
      props: {
        formInline: {
          name: row?.name ?? "",
          code: row?.code ?? "",
          mode_type: row?.mode_type ?? ModeChoices.AND,
          roles: row?.roles ?? [],
          rules: row?.rules ?? []
        },
        rolesOptions: rolesOptions.value ?? [],
        rulesOptions: rulesOptions.value ?? [],
        modeChoices: choicesDict.value["mode_type"] ?? []
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
            roles: curData.roles,
            rules: curData.rules,
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

  /** 设置部门负责人 */
  function handleLeader(row) {
    addDialog({
      title: t("systemDept.assignLeaders", { dept: row.name }),
      props: {
        formInline: {
          name: row?.name ?? "",
          code: row?.code ?? "",
          leaders: row?.leaders ?? []
        }
      },
      width: "600px",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(leaderForm),
      beforeSure: (done, { options }) => {
        const curData = options.props.formInline as LeaderFormItemProps;
        api
          .leader(row.pk, {
            leaders: curData.leaders
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
    api.choices().then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });

    if (hasGlobalAuth("list:systemRole")) {
      roleApi.list({ page: 1, size: 1000 }).then(res => {
        if (res.code === 1000 && res.data) {
          rolesOptions.value = res.data.results;
        }
      });
    }
    if (hasGlobalAuth("list:systemDataPermission")) {
      dataPermissionApi
        .list({
          page: 1,
          size: 1000
        })
        .then(res => {
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
    buttonClass,
    handleRole,
    handleLeader,
    formatResult
  };
}

export function useDeptForm(props) {
  const { t, te } = useI18n();
  const columns: PlusColumn[] = [
    {
      prop: "name",
      valueType: "input",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 }
    },
    {
      prop: "code",
      valueType: "input",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 }
    },
    {
      prop: "parent",
      valueType: "cascader",
      fieldProps: {
        valueOnClear: "",
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
      prop: "rank",
      valueType: "input-number",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 }
    },
    {
      prop: "auto_bind",
      valueType: "radio",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
      tooltip: t("systemDept.autoBindDesc"),
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
  formatFormColumns(props, columns, t, te, "systemDept");
  return {
    t,
    columns
  };
}

export function useDeptRoleForm(props) {
  const { t, te } = useI18n();
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
                {item.code ?? item.mode_type?.label}
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
      prop: "name",
      valueType: "input",
      fieldProps: {
        disabled: true
      }
    },
    {
      prop: "code",
      valueType: "input",
      fieldProps: {
        disabled: true
      }
    },
    {
      prop: "roles",
      valueType: "select",
      fieldProps: {
        multiple: true
      },
      options: customOptions(props.rolesOptions)
    },
    {
      prop: "mode_type",
      valueType: "select",
      options: formatOptions(props.modeChoices)
    },
    {
      prop: "rules",
      valueType: "select",
      fieldProps: {
        multiple: true
      },
      options: customOptions(props.rulesOptions)
    }
  ];
  formatFormColumns(props, columns, t, te, "systemDept");
  return {
    t,
    columns
  };
}

export function useDeptLeaderForm(props) {
  const { t, te } = useI18n();

  const columns: PlusColumn[] = [
    {
      prop: "name",
      valueType: "input",
      fieldProps: {
        disabled: true
      }
    },
    {
      prop: "code",
      valueType: "input",
      fieldProps: {
        disabled: true
      }
    },
    {
      prop: "leaders",
      valueType: "select",
      fieldProps: {
        multiple: true
      },
      hideInForm: computed(() => {
        return !hasGlobalAuth("list:systemSearchUsers");
      }),
      renderField: (value, onChange) => {
        onChange(value);
        return <SearchUsers v-model={value} />;
      }
    }
  ];
  formatFormColumns(props, columns, t, te, "systemDept");
  return {
    t,
    columns
  };
}
