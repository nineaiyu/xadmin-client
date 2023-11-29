import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { PaginationProps } from "@pureadmin/table";
import { reactive, ref, onMounted, toRaw, type Ref } from "vue";
import { delay, getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import {
  deleteWatchHistoryApi,
  getWatchHistoryListApi,
  manyDeleteWatchHistoryApi
} from "@/api/movies/history";
import { useRouter } from "vue-router";
import { formatTimes } from "../../util";

export function useMoviesWatchHistory(tableRef: Ref) {
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
    name: "",
    owner: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const router = useRouter();
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const colors = [
    { color: "#f56c6c", percentage: 20 },
    { color: "#e6a23c", percentage: 40 },
    { color: "#5cb87a", percentage: 60 },
    { color: "#1989fa", percentage: 80 },
    { color: "#6f7ad3", percentage: 100 }
  ];
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
      label: t("MoviesWatchHistory.userId"),
      prop: "owner",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoDetail(row as any)}>
          {row.owner.username ? row.owner.username : "/"}
        </el-link>
      )
    },
    {
      label: t("MoviesEpisode.name"),
      prop: "episode",
      minWidth: 180,
      cellRenderer: ({ row }) => (
        <el-link onClick={() => onGoFilm(row as any)}>
          {row.episode.name ? row.episode.name : row.episode.film_name}
        </el-link>
      )
    },
    {
      label: t("MoviesWatchHistory.times"),
      prop: "owner",
      minWidth: 100,
      cellRenderer: ({ row }) => (
        <div>
          <el-progress
            color={colors}
            percentage={Math.round(
              (row.times * 100) / (60 * row.episode.times)
            )}
          />
          <el-text>
            {formatTimes(row.times)} / {formatTimes(row.episode.times)}
          </el-text>
        </div>
      )
    },
    {
      label: t("MoviesWatchHistory.updateTime"),
      minWidth: 180,
      prop: "updated_time",
      formatter: ({ updated_time }) =>
        dayjs(updated_time).format("YYYY-MM-DD HH:mm:ss")
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
      width: 120,
      slot: "operation"
    }
  ];

  function onGoDetail(row: any) {
    if (row.owner && row.owner.pk) {
      router.push({
        name: "systemUser",
        query: { pk: row.owner.pk }
      });
    }
  }

  function onGoFilm(row: any) {
    router.push({
      name: "MoviesEpisode",
      query: { film_id: row.episode.film_pk, is_add: "false" }
    });
  }

  async function handleDelete(row) {
    deleteWatchHistoryApi(row.pk).then(async res => {
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
    manyDeleteWatchHistoryApi({
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
    const { data }: any = await getWatchHistoryListApi(toRaw(form));
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
    pagination,
    sortOptions,
    manySelectCount,
    onSelectionCancel,
    onSearch,
    resetForm,
    handleDelete,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSelectionChange
  };
}
