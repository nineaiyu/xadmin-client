import dayjs from "dayjs";
import { message } from "@/utils/message";
import {
  createRoleApi,
  deleteRoleApi,
  getRoleListApi,
  manyDeleteRoleApi,
  updateRoleApi
} from "@/api/system/role";
import { ElMessageBox } from "element-plus";
import {
  formatColumns,
  formatOptions,
  usePublicHooks
} from "@/views/system/hooks";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "./types";
import editForm from "../form.vue";
import type { PaginationProps } from "@pureadmin/table";
import { computed, h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import { getMenuListApi } from "@/api/system/menu";
import { handleTree } from "@/utils/tree";
import {
  cloneDeep,
  delay,
  deviceDetection,
  getKeyList
} from "@pureadmin/utils";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { getModelLabelFieldListApi } from "@/api/system/field";
import { FieldChoices } from "@/views/system/constants";
import type { PlusColumn } from "plus-pro-components";

export function useRole(tableRef: Ref) {
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
  const form = ref({
    name: "",
    code: "",
    is_active: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const selectedNum = ref(0);
  const dataList = ref([]);
  const menuTreeData = ref([]);
  const fieldLookupsData = ref({});
  const loading = ref(true);
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const showColumns = ref([]);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
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
      label: t("role.name"),
      prop: "name",
      minWidth: 120
    },
    {
      label: t("role.code"),
      prop: "code",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.code}>{row.code}</span>
    },
    {
      label: t("labels.status"),
      minWidth: 130,
      prop: "is_active",
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.active")}
          inactive-text={t("labels.inactive")}
          disabled={!hasAuth("update:systemRole")}
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
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
      width: 160,
      slot: "operation"
    }
  ]);

  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("role.name"),
        prop: "name",
        valueType: "input",
        fieldProps: {
          placeholder: t("role.verifyRoleName")
        }
      },
      {
        label: t("role.code"),
        prop: "code",
        valueType: "input",
        fieldProps: {
          placeholder: t("role.verifyRoleCode")
        }
      },
      {
        label: t("labels.status"),
        prop: "is_active",
        valueType: "select",
        options: [
          {
            label: t("labels.disable"),
            value: false
          },
          {
            label: t("labels.enable"),
            value: true
          }
        ]
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });

  function onChange({ row, index }) {
    const action =
      row.is_active === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.operateConfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style="color:var(--el-color-primary)">${row.name}</strong>`
      })}`,
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
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
        updateRoleApi(row.pk, row).then(res => {
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

  function handleDelete(row) {
    deleteRoleApi(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function handleSizeChange(val: number) {
    form.value.page = 1;
    form.value.size = val;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    form.value.page = val;
    onSearch();
  }

  function handleSelectionChange(val) {
    selectedNum.value = val.length;
  }

  function onSelectionCancel() {
    selectedNum.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  function handleManyDelete() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteRoleApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: selectedNum.value }), {
          type: "success"
        });
        onSelectionCancel();
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.value.page = 1;
      pagination.pageSize = form.value.size = 10;
    }
    loading.value = true;
    getRoleListApi(toRaw(form.value))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res.data?.results, columns, showColumns);
          dataList.value = res.data.results;
          pagination.total = res.data.total;
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        delay(500).then(() => {
          loading.value = false;
        });
      })
      .catch(() => {
        loading.value = false;
      });
  }

  function openDialog(isAdd = true, row?: FormItemProps) {
    let title = t("buttons.edit");
    if (isAdd) {
      title = t("buttons.add");
    }
    addDialog({
      title: `${title} ${t("role.role")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          name: row?.name ?? "",
          code: row?.code ?? "",
          menu: row?.menu ?? [],
          field: row?.field ?? [],
          is_active: row?.is_active ?? true,
          description: row?.description ?? ""
        },
        menuTreeData: menuTreeData.value,
        showColumns: showColumns.value,
        isAdd: isAdd
      },
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const TreeRef = formRef.value.getTreeRef();
        const curData = options.props.formInline as FormItemProps;

        function chores(detail) {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        }

        FormRef.validate(valid => {
          if (valid) {
            const menu = TreeRef!.getCheckedKeys(false);
            curData.menu = menu.filter(x => {
              return x.indexOf("+") === -1;
            });
            menu.filter(x => {
              return x.toString().indexOf("+") > -1;
            });
            const fields = {};
            menu.forEach(item => {
              if (item.indexOf("+") > -1 && !item.startsWith("+")) {
                let data = item.split("+");
                let val = fields[data[0]];
                if (!val) {
                  fields[data[0]] = [data[1]];
                } else {
                  fields[data[0]].push(data[1]);
                }
              }
            });
            curData.fields = fields;
            delete curData.field;
            loading.value = true;
            if (isAdd) {
              createRoleApi(curData).then(res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
                loading.value = false;
              });
            } else {
              updateRoleApi(curData.pk, curData).then(res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
                loading.value = false;
              });
            }
          }
        });
      }
    });
  }

  function autoFieldTree(arr) {
    function deep(arr) {
      arr.forEach(item => {
        if (item.model && item.model.length > 0 && !item.children) {
          item.children = [];
          item.model.forEach(m => {
            let data = cloneDeep(fieldLookupsData.value[m]);
            data.pk = `+${data.pk}`;
            data.children.forEach(x => {
              x.pk = `${item.pk}+${x.pk}`;
              x.parent = data.pk;
            });
            item.children.push(data);
          });
        }
        item.children && deep(item.children);
      });
    }

    if (Object.keys(fieldLookupsData.value).length) deep(arr);
  }

  /** 菜单权限 */

  const getMenuData = () => {
    loading.value = true;
    getMenuListApi({ page: 1, size: 1000 }).then(res => {
      setTimeout(() => {
        loading.value = false;
        if (res.code === 1000) {
          if (hasGlobalAuth("list:systemModelField")) {
            getModelLabelFieldListApi({
              page: 1,
              size: 1000,
              field_type: FieldChoices.ROLE
            }).then(result => {
              if (result.code === 1000) {
                handleTree(result.data.results).forEach(item => {
                  fieldLookupsData.value[item.pk] = item;
                });
                menuTreeData.value = handleTree(res.data.results);
                autoFieldTree(menuTreeData.value);
              }
            });
          }
        }
      }, 300);
    });
  };

  onMounted(() => {
    onSearch();
    if (hasGlobalAuth("list:systemMenu")) {
      getMenuData();
    }
  });

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    pagination,
    selectedNum,
    searchColumns,
    onSearch,
    openDialog,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
