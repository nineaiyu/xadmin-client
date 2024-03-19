import dayjs from "dayjs";
import { message } from "@/utils/message";
import {
  createDeptApi,
  deleteDeptApi,
  empowerDeptRoleApi,
  getDeptListApi,
  manyDeleteDeptApi,
  updateDeptApi
} from "@/api/system/dept";
import { ElMessageBox } from "element-plus";
import { computed, h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import { addDialog } from "@/components/ReDialog";
import roleForm from "../form/role.vue";
import editForm from "../form/index.vue";
import type { FormItemProps, RoleFormItemProps } from "./types";
import { getRoleListApi } from "@/api/system/role";
import {
  cloneDeep,
  delay,
  deviceDetection,
  getKeyList,
  isEmpty,
  isString
} from "@pureadmin/utils";
import { useRoute, useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { handleTree } from "@/utils/tree";
import {
  formatColumns,
  formatHigherDeptOptions,
  usePublicHooks
} from "@/views/system/hooks";
import { getDataPermissionListApi } from "@/api/system/permission";
import { ModeChoices } from "@/views/system/constants";

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
  const form = reactive({
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

  const formRef = ref();
  const route = useRoute();
  const router = useRouter();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const dataList = ref([]);
  const rolesOptions = ref([]);
  const rulesOptions = ref([]);
  const choicesDict = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const manySelectCount = ref(0);
  const showColumns = ref([]);
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
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.auto_bind}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.enable")}
          inactive-text={t("labels.disable")}
          disabled={!hasAuth("update:systemDept")}
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChangeBind(scope as any)}
        />
      )
    },
    {
      label: t("labels.status"),
      prop: "is_active",
      minWidth: 90,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.active")}
          inactive-text={t("labels.inactive")}
          disabled={!hasAuth("update:systemDept")}
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
      )
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

  function onChangeBind({ row, index }) {
    const action =
      row.auto_bind === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style="color:var(--el-color-primary)">${row.name}</strong>`
      })}`,
      {
        confirmButtonText: t("buttons.hssure"),
        cancelButtonText: t("buttons.hscancel"),
        type: "warning",
        dangerouslyUseHTMLString: true,
        draggable: true
      }
    )
      .then(() => {
        switchLoadMap.value[index] = Object.assign(
          {},
          switchLoadMap.value[index],
          {
            loading: true
          }
        );
        updateDeptApi(row.pk, row).then(res => {
          if (res.code === 1000) {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
            message(t("results.success"), { type: "success" });
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          }
        });
      })
      .catch(() => {
        row.auto_bind === false
          ? (row.auto_bind = true)
          : (row.auto_bind = false);
      });
  }

  function onChange({ row, index }) {
    const action =
      row.is_active === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style="color:var(--el-color-primary)">${row.name}</strong>`
      })}`,
      {
        confirmButtonText: t("buttons.hssure"),
        cancelButtonText: t("buttons.hscancel"),
        type: "warning",
        dangerouslyUseHTMLString: true,
        draggable: true
      }
    )
      .then(() => {
        switchLoadMap.value[index] = Object.assign(
          {},
          switchLoadMap.value[index],
          {
            loading: true
          }
        );
        updateDeptApi(row.pk, row).then(res => {
          if (res.code === 1000) {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
            message(t("results.success"), { type: "success" });
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          }
        });
      })
      .catch(() => {
        row.is_active === false
          ? (row.is_active = true)
          : (row.is_active = false);
      });
  }

  async function handleDelete(row) {
    deleteDeptApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function handleSelectionChange(val) {
    manySelectCount.value = val.length;
  }

  function onSelectionCancel() {
    manySelectCount.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  function handleManyDelete() {
    if (manySelectCount.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteDeptApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(async res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: manySelectCount.value }), {
          type: "success"
        });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      tableRef.value.getTableRef().clearSelection();
    });
  }

  async function onSearch() {
    loading.value = true;
    const { data, choices_dict } = await getDeptListApi(toRaw(form)).catch(
      () => {
        loading.value = false;
      }
    );
    formatColumns(data?.results, columns, showColumns);
    choicesDict.value = choices_dict;
    dataList.value = handleTree(data.results);
    delay(500).then(() => {
      loading.value = false;
    });
  }

  function openDialog(is_add = true, row?: FormItemProps) {
    let title = t("buttons.hsedit");
    if (is_add) {
      title = t("buttons.hsadd");
    }
    addDialog({
      title: `${title} ${t("dept.dept")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          name: row?.name ?? "",
          parent: row?.parent ?? "",
          rank: row?.rank ?? 99,
          code: row?.code ?? "",
          roles: row?.roles ?? [],
          is_active: row?.is_active ?? true,
          auto_bind: row?.auto_bind ?? false,
          description: row?.description ?? ""
        },
        treeData: formatHigherDeptOptions(cloneDeep(dataList.value)),
        showColumns: showColumns.value,
        isAdd: is_add
      },
      width: "46%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;

        async function chores(detail) {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          await onSearch(); // 刷新表格数据
        }

        FormRef.validate(valid => {
          if (valid) {
            // 表单规则校验通过
            if (is_add) {
              createDeptApi(curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateDeptApi(curData.pk, curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            }
          }
        });
      }
    });
  }

  const resetForm = async formEl => {
    if (!formEl) return;
    formEl.resetFields();
    await onSearch();
  };

  onMounted(async () => {
    if (getParameter) {
      const parameter = cloneDeep(getParameter);
      Object.keys(parameter).forEach(param => {
        if (!isString(parameter[param])) {
          parameter[param] = parameter[param].toString();
        }
      });
      form.pk = parameter.pk;
    }
    await onSearch();

    if (hasGlobalAuth("list:systemRole")) {
      rolesOptions.value = (
        await getRoleListApi({ page: 1, size: 1000 })
      ).data.results;
    }
    if (hasGlobalAuth("list:systemDataPermission")) {
      rulesOptions.value = (
        await getDataPermissionListApi({ page: 1, size: 1000 })
      ).data.results;
    }
  });

  /** 分配角色 */
  async function handleRole(row) {
    addDialog({
      title: t("dept.assignRole", { dept: row.name }),
      props: {
        formInline: {
          name: row?.name ?? "",
          code: row?.code ?? "",
          mode_type: row?.mode_type ?? ModeChoices.AND,
          rolesOptions: rolesOptions.value ?? [],
          rulesOptions: rulesOptions.value ?? [],
          choicesDict: choicesDict.value ?? [],
          ids: row?.roles ?? [],
          pks: row?.rules ?? []
        }
      },
      width: "600px",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(roleForm),
      beforeSure: (done, { options }) => {
        const curData = options.props.formInline as RoleFormItemProps;
        empowerDeptRoleApi(row.pk, {
          roles: curData.ids,
          rules: curData.pks,
          mode_type: curData.mode_type
        }).then(async res => {
          if (res.code === 1000) {
            message(t("results.success"), { type: "success" });
            onSearch();
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          }
          done(); // 关闭弹框
        });
      }
    });
  }

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    choicesDict,
    buttonClass,
    sortOptions,
    manySelectCount,
    onSearch,
    openDialog,
    onSelectionCancel,
    resetForm,
    handleRole,
    handleDelete,
    handleManyDelete,
    handleSelectionChange
  };
}
