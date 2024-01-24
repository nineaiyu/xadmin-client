import dayjs from "dayjs";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "./types";
import editForm from "../form.vue";
import type { PaginationProps } from "@pureadmin/table";
import {
  h,
  nextTick,
  onMounted,
  reactive,
  type Ref,
  ref,
  toRaw,
  watch
} from "vue";
import {
  cloneDeep,
  delay,
  formatBytes,
  getKeyList,
  isEmpty,
  isString
} from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { formatColumns, usePublicHooks } from "@/views/system/hooks";
import {
  actionRankEpisodeApi,
  createEpisodeApi,
  deleteEpisodeApi,
  getEpisodeListApi,
  manyDeleteEpisodeApi,
  updateEpisodeApi
} from "@/api/movies/episode";
import Sortable from "sortablejs";
import { useRoute } from "vue-router";
import previewForm from "@/views/movies/file/preview.vue";
import { formatTimes } from "@/views/movies/util";

export function useMoviesEpisode(tableRef: Ref) {
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
      label: `${t("MoviesEpisode.rank")} ${t("labels.descending")}`,
      key: "-rank"
    },
    {
      label: `${t("MoviesEpisode.rank")} ${t("labels.ascending")}`,
      key: "rank"
    }
  ];
  const form = reactive({
    name: "",
    film_id: "",
    enable: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const canAdd = ref(false);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const route = useRoute();
  const getParameter = cloneDeep(
    isEmpty(route.params) ? route.query : route.params
  );
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
            v-show={hasAuth("rank:MoviesEpisode") && canAdd.value}
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
      label: t("MoviesEpisode.film"),
      prop: "film",
      minWidth: 100
    },
    {
      label: t("MoviesEpisode.name"),
      prop: "name",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      label: t("MoviesFile.name"),
      prop: "name",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <span v-copy={row.files.name}>{row.files.name}</span>
      )
    },
    {
      label: t("MoviesEpisode.rank"),
      prop: "rank",
      minWidth: 100
    },
    {
      label: t("MoviesFile.duration"),
      prop: "duration",
      minWidth: 120,
      cellRenderer: ({ row }) => <span>{formatTimes(row.files.duration)}</span>
    },
    {
      label: t("MoviesFile.size"),
      prop: "size",
      minWidth: 100,
      cellRenderer: ({ row }) => <span>{formatBytes(row.files.size)}</span>
    },
    {
      label: t("MoviesFilm.views"),
      prop: "views",
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
          active-text={t("labels.publish")}
          inactive-text={t("labels.unPublish")}
          disabled={!hasAuth("update:MoviesEpisode")}
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
      width: 220,
      slot: "operation",
      hide: !(
        hasAuth("update:MoviesEpisode") || hasAuth("delete:MoviesEpisode")
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
            actionRankEpisodeApi(
              { film_id: form.film_id },
              { pks: getKeyList(dataList.value, "pk") }
            ).then(res => {
              if (res.code === 1000) {
                message(t("results.success"), { type: "success" });
                onSearch();
              } else {
                message(`${t("results.failed")}，${res.detail}`, {
                  type: "error"
                });
              }
            });
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
        row.file_id = row.files.file_id;
        updateEpisodeApi(row.pk, row).then(res => {
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
    deleteEpisodeApi(row.pk).then(async res => {
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
    manyDeleteEpisodeApi({
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
    if (form.film_id) {
      form.ordering = sortOptions[3].key;
    }
    loading.value = true;
    const { data } = await getEpisodeListApi(toRaw(form));
    formatColumns(data?.results, columns, showColumns);
    dataList.value = data.results;
    pagination.total = data.total;
    delay(500).then(() => {
      loading.value = false;
    });
    form.film_id && (canAdd.value = true);
    if (
      getParameter.is_add === "true" &&
      form.film_id &&
      canAdd.value &&
      form.film_id === getParameter.film_id
    ) {
      openDialog();
    }
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
    getParameter.is_add = false;
    addDialog({
      title: `${title} ${t("MoviesEpisode.filmVideo")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          film: form?.film_id ?? row.film ?? "",
          name: row?.name ?? "",
          description: row?.description ?? "",
          file_id: row?.files.file_id ?? "",
          file_pk: row?.files.pk ?? "",
          rank: row?.rank ?? "",
          enable: row?.enable ?? true
        }
      },
      width: "800px",
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
              createEpisodeApi(curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateEpisodeApi(curData.pk, curData).then(async res => {
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
  function previewVideo(row?: FormItemProps) {
    addDialog({
      title: `${t("MoviesFile.preview")} ${row.name}`,
      props: {
        formInline: {
          pk: row?.files?.pk ?? "-1",
          name: row?.name ?? "",
          file_id: row?.file_id ?? "",
          autoplay: true
        }
      },
      width: "640px",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      closeOnPressEscape: false,
      hideFooter: true,
      contentRenderer: () => h(previewForm)
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
      form.film_id = parameter.film_id;
    }
    onSearch();
  });
  watch(
    () => form.film_id,
    () => {
      canAdd.value = false;
    }
  );

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    canAdd,
    pagination,
    sortOptions,
    manySelectCount,
    onSelectionCancel,
    onSearch,
    resetForm,
    openDialog,
    handleDelete,
    previewVideo,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
