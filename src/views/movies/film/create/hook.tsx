import { message } from "@/utils/message";
import { reactive, ref } from "vue";

import { delay } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import {
  getFilmInfoByDoubanApi,
  importFilmInfoByDoubanApi
} from "@/api/movies/film";
import { formatColumns } from "@/views/system/hooks";

export function useSearchFile() {
  const { t } = useI18n();
  const dataList = ref([]);
  const loading = ref(false);
  const form = reactive({
    key: ""
  });
  const showColumns = ref([]);
  const columns = ref<TableColumnList>([
    {
      type: "selection",
      align: "left"
    },
    {
      label: t("MoviesFilm.name"),
      prop: "title",
      minWidth: 100
    },
    {
      label: t("MoviesFilm.starring"),
      prop: "actor",
      minWidth: 100
    },
    {
      label: t("MoviesFilm.category"),
      prop: "info",
      minWidth: 100
    },
    {
      label: t("labels.operations"),
      fixed: "right",
      width: 120,
      slot: "operation"
    }
  ]);

  function addDoubanFilm(row) {
    loading.value = true;
    importFilmInfoByDoubanApi({ movie: row.url }).then(async res => {
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

  async function onSearch() {
    loading.value = true;
    const { data } = await getFilmInfoByDoubanApi({ key: form.key });
    formatColumns(data?.results, columns, showColumns);
    dataList.value = data.results;
    delay(500).then(() => {
      loading.value = false;
    });
  }

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    onSearch,
    addDoubanFilm
  };
}
