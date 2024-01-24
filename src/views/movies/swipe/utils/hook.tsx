import dayjs from "dayjs";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "./types";
import editForm from "../form.vue";
import type { PaginationProps } from "@pureadmin/table";
import { h, nextTick, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import {
  cloneDeep,
  delay,
  getKeyList,
  isEmpty,
  isString
} from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { formatColumns, usePublicHooks } from "@/views/system/hooks";
import {
  actionRankSwipeApi,
  createSwipeApi,
  deleteSwipeApi,
  getSwipeListApi,
  manyDeleteSwipeApi,
  updateSwipeApi,
  uploadFilePosterApi
} from "@/api/movies/swipe";
import croppingUpload from "@/components/AvatarUpload/index.vue";
import Sortable from "sortablejs";
import { useRoute } from "vue-router";

export function useMoviesSwipe(tableRef: Ref) {
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
      label: `${t("MoviesSwipe.rank")} ${t("labels.descending")}`,
      key: "-rank"
    },
    {
      label: `${t("MoviesSwipe.rank")} ${t("labels.ascending")}`,
      key: "rank"
    }
  ];
  const form = reactive({
    name: "",
    description: "",
    enable: "",
    ordering: sortOptions[3].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const avatarInfo = ref();
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const route = useRoute();
  const getParameter = cloneDeep(
    isEmpty(route.params) ? route.query : route.params
  );
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
      type: "selection",
      align: "left"
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <div class="flex items-center">
          <iconify-icon-online
            v-show={hasAuth("rank:MoviesSwipe")}
            icon="icon-park-outline:drag"
            class="drag-btn cursor-grab"
            onMouseenter={(event: { preventDefault: () => void }) =>
              rowDrop(event)
            }
          />
          <p class="ml-[16px]">{row.pk}</p>
        </div>
      )
    },
    {
      label: t("MoviesSwipe.name"),
      prop: "name",
      minWidth: 120
    },
    {
      label: t("MoviesSwipe.picture"),
      prop: "picture",
      minWidth: 160,
      cellRenderer: ({ row }) => (
        <el-image
          class="w-[60px] h-[60px]"
          fit={"contain"}
          src={row.picture}
          loading={"lazy"}
          preview-teleported={true}
          preview-src-list={Array.of(row.picture)}
        />
      )
    },
    {
      label: t("MoviesSwipe.route"),
      prop: "route",
      minWidth: 120
    },
    {
      label: t("MoviesSwipe.rank"),
      prop: "rank",
      minWidth: 100
    },
    {
      label: t("labels.status"),
      minWidth: 130,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.enable}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.enable")}
          inactive-text={t("labels.disable")}
          disabled={!hasAuth("update:MoviesSwipe")}
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
      width: 260,
      slot: "operation",
      hide: !(
        hasAuth("update:MoviesSwipe") ||
        hasAuth("delete:MoviesSwipe") ||
        hasAuth("upload:MoviesSwipePicture")
      )
    }
  ]);
  const rowDrop = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    nextTick(() => {
      const wrapper: HTMLElement = document.querySelector(
        ".el-table__body-wrapper tbody"
      );
      Sortable.create(wrapper, {
        animation: 300,
        handle: ".drag-btn",
        onEnd: ({ newIndex, oldIndex }) => {
          const currentRow = dataList.value.splice(oldIndex, 1)[0];
          dataList.value.splice(newIndex, 0, currentRow);
          if (newIndex !== oldIndex) {
            actionRankSwipeApi({ pks: getKeyList(dataList.value, "pk") }).then(
              res => {
                if (res.code === 1000) {
                  message(t("results.success"), { type: "success" });
                  onSearch();
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              }
            );
          }
        }
      });
    });
  };
  function onChange({ row, index }) {
    const action =
      row.enable === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.hsoperateconfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style='color:var(--el-color-primary)'>${row.name}</strong>`
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
        updateSwipeApi(row.pk, row).then(res => {
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

  async function handleDelete(row) {
    deleteSwipeApi(row.pk).then(async res => {
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
    manyDeleteSwipeApi({
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
    const { data }: any = await getSwipeListApi(toRaw(form));
    dataList.value = data.results;
    formatColumns(data?.results, columns, showColumns);
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
      title: `${title} ${t("MoviesSwipe.swipes")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          name: row?.name ?? "",
          rank: row?.rank ?? 999,
          route: row?.route ?? "",
          description: row?.description ?? "",
          enable: row?.enable ?? false
        }
      },
      width: "50%",
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
              createSwipeApi(curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateSwipeApi(curData.pk, curData).then(async res => {
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

  function handleUpload(row) {
    addDialog({
      title: t("MoviesSwipe.updatePictureTitle", { name: row.name }),
      width: "40%",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () =>
        h(croppingUpload, {
          imgSrc: row.picture ?? "",
          onCropper: info => (avatarInfo.value = info),
          options: { aspectRatio: 2 },
          circled: false,
          quality: 0,
          canvasOption: { width: 1000, height: 1000 }
        }),
      beforeSure: done => {
        const avatarFile = new File([avatarInfo.value.blob], "avatar.png", {
          type: avatarInfo.value.blob.type,
          lastModified: Date.now()
        });

        const data = new FormData();
        data.append("file", avatarFile);
        uploadFilePosterApi(row.pk, data).then(res => {
          if (res.code === 1000) {
            message(t("results.success"), { type: "success" });
            onSearch();
            done();
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
            done();
          }
        });
      }
    });
  }
  onMounted(() => {
    if (getParameter) {
      const parameter = cloneDeep(getParameter);
      Object.keys(parameter).forEach(param => {
        if (!isString(parameter[param])) {
          parameter[param] = parameter[param].toString();
        }
      });
      if (parameter.is_add) {
        openDialog(true, parameter);
      }
    }
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
    handleUpload,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
