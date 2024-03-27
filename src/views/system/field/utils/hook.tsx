import dayjs from "dayjs";
import {
  getModelLabelFieldListApi,
  syncModelLabelFieldApi
} from "@/api/system/field";
import type { PaginationProps } from "@pureadmin/table";
import { computed, onMounted, reactive, ref, toRaw } from "vue";
import { delay } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { formatColumns, formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";

export function useModelField() {
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
    label: "",
    parent: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });
  const dataList = ref([]);
  const loading = ref(true);
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
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("modelField.name"),
      prop: "name",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      label: t("modelField.label"),
      prop: "label",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.label}>{row.label}</span>
    },
    {
      label: t("modelField.parent"),
      prop: "parent",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.parent}>{row.parent}</span>
    },
    {
      label: t("modelField.fieldType"),
      prop: "field_type_display",
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
      label: t("sorts.updatedDate"),
      minWidth: 180,
      prop: "updated_time",
      formatter: ({ updated_time }) =>
        dayjs(updated_time).format("YYYY-MM-DD HH:mm:ss")
    }
  ]);

  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("modelField.name"),
        prop: "name",
        valueType: "input"
      },
      {
        label: t("modelField.label"),
        prop: "label",
        valueType: "input"
      },
      {
        label: t("modelField.parent"),
        prop: "parent",
        valueType: "input"
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });

  function handleSizeChange(val: number) {
    form.value.page = 1;
    form.value.size = val;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    form.value.page = val;
    onSearch();
  }

  function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.value.page = 1;
      pagination.pageSize = form.value.size = 10;
    }
    loading.value = true;
    getModelLabelFieldListApi(toRaw(form.value))
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

  const handleSync = () => {
    syncModelLabelFieldApi().then(res => {
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
    searchColumns,
    onSearch,
    handleSync,
    handleSizeChange,
    handleCurrentChange
  };
}
