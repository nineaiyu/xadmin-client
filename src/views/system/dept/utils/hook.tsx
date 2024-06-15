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
import { roleApi } from "@/api/system/role";
import { cloneDeep, deviceDetection, getKeyList } from "@pureadmin/utils";
import { useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import {
  customRolePermissionOptions,
  formatFormColumns,
  formatHigherDeptOptions,
  formatOptions
} from "@/views/system/hooks";
import { dataPermissionApi } from "@/api/system/permission";
import { ModeChoices } from "@/views/system/constants";

import { renderOption, renderSwitch } from "@/views/system/render";
import { handleTree } from "@/utils/tree";
import addOrEdit from "@/components/ReBaseTable/src/form/addOrEdit.vue";

export function useDept(tableRef: Ref) {
  const { t, te } = useI18n();

  const api = reactive({
    list: deptApi.list,
    create: deptApi.create,
    delete: deptApi.delete,
    update: deptApi.patch,
    empower: deptApi.empower,
    choices: deptApi.choices,
    fields: deptApi.fields,
    import: deptApi.import,
    export: deptApi.export,
    batchDelete: deptApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemDept"),
    create: hasAuth("create:systemDept"),
    delete: hasAuth("delete:systemDept"),
    update: hasAuth("update:systemDept"),
    empower: hasAuth("empower:systemDept"),
    choices: hasAuth("choices:systemDept"),
    import: hasAuth("import:systemDept"),
    export: hasAuth("export:systemDept"),
    batchDelete: hasAuth("batchDelete:systemDept")
  });

  const pagination = reactive({
    total: 0,
    pageSize: 1000,
    currentPage: 1,
    pageSizes: [20, 100, 1000],
    background: true
  });

  const editForm = shallowRef({
    title: t("systemDept.dept"),
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
      },
      parent: row => {
        return row?.parent?.pk ?? "";
      }
    },
    formProps: {
      rules: {
        name: [
          {
            required: true,
            message: t("systemDept.name"),
            trigger: "blur"
          }
        ],
        code: [
          {
            required: true,
            message: t("systemDept.code"),
            trigger: "blur"
          }
        ],
        rank: [
          {
            required: true,
            message: t("commonLabels.rank"),
            trigger: "blur"
          }
        ]
      }
    },
    columns: ({ data }) => {
      return [
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
          options: formatHigherDeptOptions(cloneDeep(data))
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
      prop: "roles",
      width: 160,
      slot: "roles"
    },
    {
      prop: "rules",
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
    const assignRoles = reactive({
      columns: [
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
          options: customRolePermissionOptions(rolesOptions.value ?? [])
        },
        {
          prop: "mode_type",
          valueType: "select",
          options: formatOptions(choicesDict.value["mode_type"] ?? [])
        },
        {
          prop: "rules",
          valueType: "select",
          fieldProps: {
            multiple: true
          },
          options: customRolePermissionOptions(rulesOptions.value ?? [])
        }
      ]
    });
    formatFormColumns(
      { isAdd: true, showColumns: [] },
      assignRoles?.columns as Array<any>,
      t,
      te,
      "systemDept"
    );

    addDialog({
      title: t("systemDept.assignRole", { dept: row.name }),
      props: {
        formInline: {
          name: row?.name ?? "",
          code: row?.code ?? "",
          mode_type: row?.mode_type ?? ModeChoices.AND,
          roles: getKeyList(row?.roles ?? [], "pk") ?? [],
          rules: getKeyList(row?.rules ?? [], "pk") ?? []
        },
        ...assignRoles
      },
      width: "600px",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(addOrEdit),
      beforeSure: (done, { options }) => {
        const curData = options.props.formInline;
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
    pagination,
    buttonClass,
    handleRole,
    formatResult
  };
}
