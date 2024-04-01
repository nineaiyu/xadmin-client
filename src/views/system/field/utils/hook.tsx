import dayjs from "dayjs";
import {
  getModelLabelFieldDetailApi,
  getModelLabelFieldListApi,
  syncModelLabelFieldApi
} from "@/api/system/field";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { cloneDeep } from "@pureadmin/utils";
import { formatOptions } from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";
import { computed, onMounted, reactive, type Ref, ref } from "vue";

export function useModelField(tableRef: Ref) {
  const { t } = useI18n();
  const choicesDict = ref({});
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
  const searchForm = ref({
    name: "",
    label: "",
    parent: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const defaultValue = cloneDeep(searchForm.value);
  const api = reactive({
    list: getModelLabelFieldListApi,
    sync: syncModelLabelFieldApi,
    detail: getModelLabelFieldDetailApi
  });

  const auth = reactive({
    list: hasAuth("list:systemModelField"),
    sync: hasAuth("sync:systemModelField")
  });

  const columns = ref<TableColumnList>([
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("modelFieldManagement.name"),
      prop: "name",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      label: t("modelFieldManagement.label"),
      prop: "label",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.label}>{row.label}</span>
    },
    {
      label: t("modelFieldManagement.parent"),
      prop: "parent",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.parent}>{row.parent}</span>
    },
    {
      label: t("modelFieldManagement.fieldType"),
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
        label: t("modelFieldManagement.name"),
        prop: "name",
        valueType: "input"
      },
      {
        label: t("modelFieldManagement.label"),
        prop: "label",
        valueType: "input"
      },
      {
        label: t("modelFieldManagement.parent"),
        prop: "parent",
        valueType: "input"
      },
      {
        label: t("modelFieldManagement.fieldType"),
        prop: "field_type",
        valueType: "select",
        options: computed(() => {
          return formatOptions(choicesDict.value["field_type"]);
        })
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });

  const handleSync = () => {
    api.sync().then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        tableRef.value.onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };
  onMounted(() => {
    api.detail("choices").then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });
  });
  return {
    t,
    api,
    auth,
    columns,
    searchForm,
    defaultValue,
    searchColumns,
    handleSync
  };
}
