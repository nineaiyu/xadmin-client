import dayjs from "dayjs";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import type { categoryProps, FormItemProps } from "./types";
import editForm from "../form.vue";
import type { PaginationProps } from "@pureadmin/table";
import { computed, h, onMounted, reactive, ref, type Ref, toRaw } from "vue";
import { delay, getKeyList } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { formatColumns, usePublicHooks } from "@/views/system/hooks";
import {
  createFilmApi,
  deleteFilmApi,
  getFilmListApi,
  importFilmInfoByDoubanApi,
  manyDeleteFilmApi,
  updateFilmApi,
  uploadFilePosterApi
} from "@/api/movies/film";
import croppingUpload from "@/components/AvatarUpload/index.vue";
import { useRouter } from "vue-router";
import createForm from "../create/index.vue";

export function useMoviesFilm(tableRef: Ref) {
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
      label: `${t("MoviesFilm.views")} ${t("labels.descending")}`,
      key: "-views"
    },
    {
      label: `${t("MoviesFilm.views")} ${t("labels.ascending")}`,
      key: "views"
    },
    {
      label: `${t("MoviesFilm.times")} ${t("labels.descending")}`,
      key: "-times"
    },
    {
      label: `${t("MoviesFilm.times")} ${t("labels.ascending")}`,
      key: "times"
    },
    {
      label: `${t("MoviesFilm.rate")} ${t("labels.descending")}`,
      key: "-rate"
    },
    {
      label: `${t("MoviesFilm.rate")} ${t("labels.ascending")}`,
      key: "rate"
    }
  ];
  const form = reactive({
    name: "",
    language: "",
    channel: "",
    region: "",
    starring: "",
    description: "",
    release_date: "",
    min_release_date: "",
    max_release_date: "",
    enable: "",
    category: "",
    categories: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const formRef = ref();
  const router = useRouter();
  const avatarInfo = ref();
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  const categoryData = ref<categoryProps[]>([]);
  const regionData = ref<categoryProps[]>([]);
  const channelData = ref<categoryProps[]>([]);
  const languageData = ref<categoryProps[]>([]);
  const buttonClass = computed(() => {
    return [
      "!h-[20px]",
      "reset-margin",
      "!text-gray-500",
      "dark:!text-white",
      "dark:hover:!text-primary"
    ];
  });
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
      minWidth: 100
    },
    {
      label: t("MoviesFilm.name"),
      prop: "name",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      label: t("MoviesFilm.poster"),
      prop: "poster",
      minWidth: 160,
      cellRenderer: ({ row }) => (
        <el-image
          class="w-[60px] h-[60px]"
          fit={"contain"}
          src={row.poster}
          loading={"lazy"}
          preview-teleported={true}
          preview-src-list={Array.of(row.poster)}
        />
      )
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
          disabled={!hasAuth("update:MoviesFilm")}
          inline-prompt
          style={switchStyle.value}
          onChange={() => onChange(scope as any)}
        />
      )
    },
    {
      label: t("MoviesFilm.taskStatus"),
      prop: "running",
      minWidth: 120,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.running ? "danger" : ""}
          effect="plain"
        >
          {row.running ? t("MoviesFilm.taskRun") : t("MoviesFilm.taskOk")}
        </el-tag>
      )
    },
    {
      label: t("MoviesFilm.channel"),
      prop: "channel",
      minWidth: 120,
      slot: "channel"
    },
    {
      label: t("MoviesFilm.episodeCount"),
      prop: "episode_count",
      minWidth: 120
    },
    {
      label: t("MoviesFilm.views"),
      prop: "views",
      minWidth: 120
    },
    {
      label: t("MoviesFilm.language"),
      prop: "language",
      minWidth: 120,
      slot: "language"
    },
    {
      label: t("MoviesFilm.releaseDate"),
      prop: "release_date",
      minWidth: 120
    },
    {
      label: t("MoviesFilm.category"),
      prop: "category",
      width: 160,
      slot: "category"
    },

    {
      label: t("MoviesFilm.rate"),
      prop: "rate",
      minWidth: 180,
      cellRenderer: ({ row }) => (
        <el-rate
          model-value={Number(row.rate)}
          disabled
          show-score
          max={10}
        ></el-rate>
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
      width: 180,
      slot: "operation"
    }
  ]);

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
        updateFilmApi(row.pk, row).then(res => {
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
    deleteFilmApi(row.pk).then(async res => {
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
    manyDeleteFilmApi({
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
    const query = toRaw(form);
    query.categories = JSON.stringify(query.category);
    delete query.category;
    if (query.release_date && query.release_date.length === 2) {
      query.min_release_date = query.release_date[0];
      query.max_release_date = query.release_date[1];
      delete query.release_date;
    } else {
      query.min_release_date = "";
      query.max_release_date = "";
    }
    const { data, category, channel, region, language }: any =
      await getFilmListApi(query);
    dataList.value = data.results;
    formatColumns(data?.results, columns, showColumns);
    pagination.total = data.total;
    categoryData.value = category;
    channelData.value = channel;
    regionData.value = region;
    languageData.value = language;
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
      title: `${title} ${t("MoviesFilm.films")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          name: row?.name ?? "",
          title: row?.title ?? "",
          poster: row?.poster ?? "",
          category: row?.category ?? [],
          episodes: row?.episodes ?? [],
          region: row?.region ?? "",
          language: row?.language ?? "",
          channel: row?.channel ?? "",
          release_date: row?.release_date ?? "",
          starring: row?.starring ?? [],
          description: row?.description ?? "",
          introduction: row?.introduction ?? "",
          rate: Number(row?.rate) ?? 0,
          views: row?.views ?? 0,
          enable: row?.enable ?? false,
          times: row?.times ?? 0
        },
        categoryData: categoryData,
        channelData: channelData,
        regionData: regionData,
        languageData: languageData
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
              createFilmApi(curData).then(async res => {
                if (res.code === 1000) {
                  await chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateFilmApi(curData.pk, curData).then(async res => {
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

  function handleAddEpisode(row, is_add = "true") {
    router.push({
      name: "MoviesEpisode",
      query: { film_id: row.pk, is_add: is_add }
    });
  }

  function handleAddSwipe(row) {
    router.push({
      name: "MoviesSwipe",
      query: { route: `/detail/${row.pk}`, is_add: "true", name: row.name }
    });
  }

  function handleUpload(row) {
    addDialog({
      title: t("MoviesFilm.updatePosterTitle", { name: row.name }),
      width: "40%",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () =>
        h(croppingUpload, {
          imgSrc: row.poster ?? "",
          onCropper: info => (avatarInfo.value = info),
          options: { aspectRatio: 0.75 },
          circled: false,
          quality: 0,
          canvasOption: { width: 600, height: 600 }
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

  function openImportFileDialog() {
    addDialog({
      title: "豆瓣搜索影片",
      width: "60%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      closeOnPressEscape: false,
      hideFooter: true,
      contentRenderer: () => h(createForm)
    });
  }
  onMounted(() => {
    onSearch();
  });

  function addDoubanFilm(row) {
    loading.value = true;
    importFilmInfoByDoubanApi({ movie: row.douban }).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), {
          type: "success"
        });
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      loading.value = false;
    });
  }
  return {
    t,
    form,
    loading,
    columns,
    dataList,
    pagination,
    sortOptions,
    buttonClass,
    categoryData,
    channelData,
    languageData,
    regionData,
    manySelectCount,
    onSelectionCancel,
    onSearch,
    resetForm,
    openDialog,
    handleUpload,
    handleDelete,
    addDoubanFilm,
    handleAddSwipe,
    handleManyDelete,
    handleAddEpisode,
    handleSizeChange,
    handleCurrentChange,
    openImportFileDialog,
    handleSelectionChange
  };
}
