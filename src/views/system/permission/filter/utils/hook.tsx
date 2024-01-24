import { useI18n } from "vue-i18n";
import type { FormItemProps } from "./types";
import { addDialog } from "@/components/ReDialog/index";
import { h, onMounted, ref } from "vue";
import addForm from "../add.vue";

export function useFieldRule(
  fieldLookupsData: any[],
  dataList: any[],
  valuesData: any[]
) {
  const { t } = useI18n();
  const formRef = ref();
  const ruleInfo = ref({});
  onMounted(() => {
    if (dataList.length) {
      dataList.forEach(item => {
        ruleInfo.value[`${item.table}__${item.field}__${item.match}`] = {
          table: item.table,
          field: item.field,
          match: item.match,
          exclude: item.exclude,
          type: item.type,
          value: item.value
        };
      });
    }
  });
  const columns = ref<TableColumnList>([
    {
      label: t("permission.table"),
      prop: "table",
      minWidth: 100
    },
    {
      label: t("permission.field"),
      prop: "field",
      minWidth: 100
    },
    {
      label: t("permission.addMatch"),
      prop: "match",
      minWidth: 100
    },
    {
      label: t("permission.addExclude"),
      prop: "exclude",
      minWidth: 100
    },
    {
      label: t("permission.addType"),
      prop: "type",
      minWidth: 100
    },
    {
      label: t("permission.addValue"),
      prop: "value",
      minWidth: 100
    },
    {
      label: t("labels.operations"),
      fixed: "right",
      width: 100,
      slot: "operation"
    }
  ]);

  function handleDelete(row) {
    const key = `${row.table}__${row.field}__${row.match}`;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete ruleInfo.value[key];
  }

  function openDialog(row) {
    addDialog({
      title: `${t("buttons.hsadd")} ${t("permission.rules")}`,
      props: {
        fieldLookupsData: fieldLookupsData,
        valuesData: valuesData,
        formInline: {
          name: [row?.table, row?.field] ?? [],
          match: row?.match ?? "",
          exclude: row?.exclude ?? false,
          value: row?.value ?? "",
          type: row?.type ?? ""
        }
      },
      width: "40%",
      draggable: true,
      fullscreenIcon: true,
      closeOnClickModal: false,
      top: "10vh",
      contentRenderer: () => h(addForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const data = options.props.formInline as FormItemProps;
        const FormRef = formRef.value.getRef();
        FormRef.validate(valid => {
          if (valid) {
            ruleInfo.value[`${data.name[0]}__${data.name[1]}__${data.match}`] =
              {
                table: data.name[0],
                field: data.name[1],
                match: data.match,
                exclude: data.exclude,
                type: data.type,
                value: data.value
              };
            done(); // 关闭弹框
          }
        });
      }
    });
  }

  return {
    t,
    columns,
    openDialog,
    handleDelete,
    ruleInfo
  };
}
