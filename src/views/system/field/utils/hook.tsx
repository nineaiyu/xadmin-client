import dayjs from "dayjs";
import {
  getModelLabelFieldListApi,
  syncModelLabelFieldApi
} from "@/api/system/field";
import type { PaginationProps } from "@pureadmin/table";
import { onMounted, reactive, ref, toRaw } from "vue";
import { delay } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { formatColumns } from "@/views/system/hooks";

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
  const form = reactive({
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
      type: "selection",
      align: "left"
    },
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

  async function handleSizeChange(val: number) {
    form.page = 1;
    form.size = val;
    await onSearch();
  }

  async function handleCurrentChange(val: number) {
    form.page = val;
    await onSearch();
  }

  async function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.page = 1;
      pagination.pageSize = form.size = 10;
    }
    loading.value = true;
    const { data } = await getModelLabelFieldListApi(toRaw(form));
    formatColumns(data?.results, columns, showColumns);
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
    sortOptions,
    onSearch,
    resetForm,
    handleSync,
    handleSizeChange,
    handleCurrentChange
  };
}
