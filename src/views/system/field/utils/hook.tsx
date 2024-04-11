import dayjs from "dayjs";
import { modelLabelFieldApi } from "@/api/system/field";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { reactive, type Ref, ref } from "vue";

export function useModelField(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive({
    list: modelLabelFieldApi.list,
    sync: modelLabelFieldApi.sync,
    detail: modelLabelFieldApi.detail,
    fields: modelLabelFieldApi.fields,
    lookups: modelLabelFieldApi.lookups
  });

  const auth = reactive({
    list: hasAuth("list:systemModelField"),
    sync: hasAuth("sync:systemModelField"),
    detail: hasAuth("detail:systemModelField"),
    fields: hasAuth("fields:systemModelField"),
    lookups: hasAuth("lookups:systemModelField")
  });

  const columns = ref<TableColumnList>([
    {
      prop: "pk",
      minWidth: 100
    },
    {
      prop: "name",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      prop: "label",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.label}>{row.label}</span>
    },
    {
      prop: "parent",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.parent}>{row.parent}</span>
    },
    {
      prop: "field_type_display",
      minWidth: 150
    },
    {
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

  return {
    t,
    api,
    auth,
    columns,
    handleSync
  };
}
