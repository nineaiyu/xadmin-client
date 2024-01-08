import dayjs from "dayjs";
import { message } from "@/utils/message";
import {
  actionInvalidCacheApi,
  createUserConfigApi,
  deleteUserConfigApi,
  getUserConfigListApi,
  manyDeleteUserConfigApi,
  updateUserConfigApi
} from "@/api/system/config/user";
import { ElMessageBox } from "element-plus";
import { usePublicHooks } from "@/views/system/hooks";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "./types";
import editForm from "../form.vue";
import type { PaginationProps } from "@pureadmin/table";
import { h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import { delay, getKeyList } from "@pureadmin/utils";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

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
  const form = reactive({
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
  const router = useRouter();
  const formRef = ref();
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const columns: TableColumnList = [
    {
      type: "selection",
      align: "left"
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("user.userId"),
      prop: "owner",
      minWidth: 100,
      cellRenderer: ({ row }) => <el-text>{row.owner_info?.pk}</el-text>
    },
    {
      label: t("user.userInfo"),
      prop: "owner",
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
        <span v-copy={row.cache_value}>{row.cache_value}</span>
      )
    },
    {
      label: t("labels.status"),
      minWidth: 130,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.active")}
          inactive-text={t("labels.inactive")}
          disabled={!hasAuth("update:systemUserConfig")}
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
      prop: "createTime",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: t("labels.operations"),
      fixed: "right",
      width: 260,
      slot: "operation"
    }
  ];

  function onGoUserDetail(row: any) {
    if (
      hasGlobalAuth("list:systemUser") &&
      row.owner_info &&
      row.owner_info?.pk
    ) {
      router.push({
        name: "systemUser",
        query: { pk: row.owner_info.pk }
      });
    }
  }
  function onChange({ row, index }) {
    const action =
      row.is_active === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style="color:var(--el-color-primary)">${row.key}</strong>`
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
        updateUserConfigApi(row.pk, row).then(res => {
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
    deleteUserConfigApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function handleSizeChange(val: number) {
    form.page = 1;
    form.size = val;
    await onSearch();
  }

  async function handleCurrentChange(val: number) {
    form.page = val;
    await onSearch();
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
    manyDeleteUserConfigApi({
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
    });
  }

  async function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    const { data } = await getUserConfigListApi(toRaw(form));
    dataList.value = data.results;
    pagination.total = data.total;

    delay(500).then(() => {
      loading.value = false;
    });
  }

  const resetForm = formEl => {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  };

  function openDialog(is_add = true, row?: FormItemProps) {
    let title = t("buttons.hsedit");
    if (is_add) {
      title = t("buttons.hsadd");
    }
    addDialog({
      title: `${title} ${t("configUser.configUser")}`,
      props: {
        formInline: {
          is_add: is_add,
          pk: row?.pk ?? "",
          key: row?.key ?? "",
          value: row?.value ?? "",
          owner: row?.owner ?? "",
          config_user: row?.owner ? [row?.owner] : [],
          is_active: row?.is_active ?? true,
          description: row?.description ?? ""
        }
      },
      width: "40%",
      draggable: true,
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
            if (is_add) {
              createUserConfigApi(curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateUserConfigApi(curData.pk, curData).then(async res => {
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

  const handleInvalidCache = row => {
    actionInvalidCacheApi(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };

  onMounted(() => {
    onSearch();
  });

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    pagination,
    sortOptions,
    manySelectCount,
    onSelectionCancel,
    onSearch,
    resetForm,
    openDialog,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleInvalidCache,
    handleCurrentChange,
    handleSelectionChange
  };
}
