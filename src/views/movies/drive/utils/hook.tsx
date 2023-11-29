import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { reactive, ref, h, onMounted, toRaw, type Ref, computed } from "vue";
import {
  getDriveQrcodeApi,
  getDriveListApi,
  deleteDriveApi,
  checkDriveQrcodeStatusApi,
  updateDriveApi,
  cleanDriveApi,
  manyDeleteDriveApi
} from "@/api/movies/drive";
import editForm from "../edit.vue";
import { delay, formatBytes, getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { ElMessageBox } from "element-plus";
import type { FormItemProps } from "./types";
import { addDialog } from "@/components/ReDialog";
import { usePublicHooks } from "@/views/system/hooks";

export function useDrive(tableRef: Ref) {
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
      label: `${t("MoviesDrive.updateDate")} ${t("labels.descending")}`,
      key: "-updated_time"
    },
    {
      label: `${t("MoviesDrive.updateDate")} ${t("labels.ascending")}`,
      key: "updated_time"
    },

    {
      label: `${t("MoviesDrive.totalSize")} ${t("labels.descending")}`,
      key: "-total_size"
    },
    {
      label: `${t("MoviesDrive.totalSize")} ${t("labels.ascending")}`,
      key: "total_size"
    },
    {
      label: `${t("MoviesDrive.usedSize")} ${t("labels.descending")}`,
      key: "-used_size"
    },
    {
      label: `${t("MoviesDrive.usedSize")} ${t("labels.ascending")}`,
      key: "used_size"
    }
  ];
  const qrcodeInfo = reactive({
    qrcode: "",
    sid: "",
    loop: false
  });
  const form = reactive({
    description: "",
    user_name: "",
    user_id: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const switchLoadMap = ref({});
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
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
      label: t("MoviesDrive.userid"),
      prop: "user_id",
      minWidth: 120
    },
    {
      label: t("MoviesDrive.username"),
      prop: "user_name",
      minWidth: 120
    },
    {
      label: t("MoviesDrive.avatar"),
      prop: "avatar",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <el-image
          class="w-[60px] h-[60px]"
          fit={"contain"}
          src={row.avatar}
          loading={"lazy"}
          preview-teleported={true}
          preview-src-list={Array.of(row.avatar)}
        />
      )
    },
    {
      label: t("MoviesDrive.totalSize"),
      prop: "total_size",
      minWidth: 100,
      cellRenderer: ({ row }) => <span>{formatBytes(row.total_size)}</span>
    },
    {
      label: t("MoviesDrive.usedSize"),
      prop: "used_size",
      minWidth: 100,
      cellRenderer: ({ row }) => <span>{formatBytes(row.used_size)}</span>
    },
    {
      label: t("MoviesDrive.active"),
      prop: "active",
      minWidth: 90,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.active ? "" : "danger"}
          effect="plain"
          onClick={() => !row.active && handleAdd(row.user_id)}
        >
          {row.active ? t("labels.active") : t("labels.inactive")}
        </el-tag>
      )
    },
    {
      label: t("labels.status"),
      prop: "enable",
      minWidth: 90,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.enable}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.active")}
          inactive-text={t("labels.inactive")}
          disabled={!hasAuth("update:MoviesDrive")}
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
      )
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
      width: 280,
      slot: "operation"
    }
  ];
  const buttonClass = computed(() => {
    return [
      "!h-[20px]",
      "reset-margin",
      "!text-gray-500",
      "dark:!text-white",
      "dark:hover:!text-primary"
    ];
  });

  function onChange({ row, index }) {
    const action =
      row.enable === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style="color:var(--el-color-primary)">${row.user_name}</strong>`
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
        updateDriveApi(row.pk, row).then(res => {
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
        row.enable === false ? (row.enable = true) : (row.enable = false);
      });
  }

  function openDialog(row?: FormItemProps) {
    let title = t("buttons.hsedit");
    addDialog({
      title: `${title} ${t("MoviesDrive.drive")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          user_name: row?.user_name ?? "",
          user_id: row?.user_id ?? "",
          default_drive_id: row?.default_drive_id ?? "",
          default_sbox_drive_id: row?.default_sbox_drive_id ?? "",
          x_device_id: row?.x_device_id ?? "",
          used_size: row?.used_size ?? "",
          total_size: row?.total_size ?? "",
          enable: row?.enable ?? "",
          description: row?.description ?? ""
        }
      },
      width: "46%",
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
            updateDriveApi(curData.pk, curData).then(async res => {
              if (res.code === 1000) {
                await chores(res.detail);
              } else {
                message(`${t("results.failed")}，${res.detail}`, {
                  type: "error"
                });
              }
            });
          }
        });
      }
    });
  }

  function handleClean(row) {
    cleanDriveApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function handleDelete(row) {
    deleteDriveApi(row.pk).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        await onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function stopLoopCheck() {
    qrcodeInfo.sid = "";
    qrcodeInfo.qrcode = "";
    qrcodeInfo.loop = false;
  }

  function loopCheckQrcode(user_id: string) {
    if (qrcodeInfo.loop) {
      checkDriveQrcodeStatusApi({ sid: qrcodeInfo.sid, user_id: user_id }).then(
        async (res: any) => {
          if (res.data.pending_status) {
            if (res.data.data.msg) {
              message(`${t("results.failed")}，${res.detail}`, {
                type: "error"
              });
            } else {
              message(t("results.success"), { type: "success" });
            }
            stopLoopCheck();
            await onSearch();
          } else {
            loopCheckQrcode(user_id);
          }
        }
      );
    }
  }

  function handleAdd(user_id = "") {
    getDriveQrcodeApi().then((res: any) => {
      if (res.code === 1000) {
        qrcodeInfo.qrcode = res.data.qr_link;
        qrcodeInfo.sid = res.data.sid;
        qrcodeInfo.loop = true;
        loopCheckQrcode(user_id);
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
    manyDeleteDriveApi({
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
    const { data } = await getDriveListApi(toRaw(form));
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

  onMounted(() => {
    onSearch();
  });

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    qrcodeInfo,
    pagination,
    buttonClass,
    sortOptions,
    manySelectCount,
    onSelectionCancel,
    onSearch,
    resetForm,
    handleAdd,
    openDialog,
    stopLoopCheck,
    handleClean,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
