import dayjs from "dayjs";
import { message } from "@/utils/message";
import { ref, onMounted, type Ref, reactive } from "vue";

import { delay, formatBytes, getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import {
  getFileInfoByDriveApi,
  importFileInfoByDriveApi
} from "@/api/movies/drive";

export function useSearchFile(tableRef: Ref, pk: string) {
  const { t } = useI18n();
  const manySelectCount = ref(0);
  const dataList = ref([]);
  const loading = ref(true);
  const form = reactive({
    pk: pk,
    file_id: ""
  });
  const columns: TableColumnList = [
    {
      type: "selection",
      align: "left"
    },
    {
      label: t("MoviesFile.name"),
      prop: "name",
      minWidth: 200,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      label: t("MoviesFile.size"),
      prop: "size",
      minWidth: 100,
      cellRenderer: ({ row }) => <span>{formatBytes(row.size)}</span>
    },
    {
      label: t("MoviesFile.duration"),
      prop: "duration",
      minWidth: 100
    },
    {
      label: t("MoviesFilm.category"),
      prop: "category",
      minWidth: 100
    },
    {
      label: t("sorts.createdDate"),
      minWidth: 180,
      prop: "createTime",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    }
  ];

  function handleSelectionChange(val) {
    manySelectCount.value = val.length;
  }

  function onSelectionCancel() {
    manySelectCount.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  function handleManyImportFile() {
    if (manySelectCount.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    importFileInfoByDriveApi(form.pk, {
      file_ids: getKeyList(manySelectData, "file_id")
    }).then(async res => {
      if (res.code === 1000) {
        message(t("results.success", { count: manySelectCount.value }), {
          type: "success"
        });
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function onSearch() {
    loading.value = true;
    const { data } = await getFileInfoByDriveApi(form.pk, {
      file_id: form.file_id
    });
    dataList.value = data.results;
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
    manySelectCount,
    onSelectionCancel,
    onSearch,
    resetForm,
    handleManyImportFile,
    handleSelectionChange
  };
}
