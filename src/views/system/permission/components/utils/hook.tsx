import { useI18n } from "vue-i18n";
import type { FormItemProps } from "./types";
import { addDialog } from "@/components/ReDialog/index";
import { h, onMounted, ref } from "vue";
import addForm from "../add.vue";
import { deviceDetection } from "@pureadmin/utils";

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
      label: t("systemPermission.table"),
      prop: "table",
      minWidth: 100
    },
    {
      label: t("systemPermission.field"),
      prop: "field",
      minWidth: 100
    },
    {
      label: t("systemPermission.addMatch"),
      prop: "match",
      minWidth: 100
    },
    {
      label: t("systemPermission.addExclude"),
      prop: "exclude",
      minWidth: 100
    },
    {
      label: t("systemPermission.addType"),
      prop: "type",
      minWidth: 100
    },
    {
      label: t("systemPermission.addValue"),
      prop: "value",
      minWidth: 100
    },
    {
      label: t("commonLabels.operation"),
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
    const name = [row?.table, row?.field];
    if (row?.table !== "*") {
      name.unshift(row?.table?.split(".")[0]);
    }
    addDialog({
      title: `${t("buttons.add")} ${t("systemPermission.rules")}`,
      props: {
        fieldLookupsData: fieldLookupsData,
        valuesData: valuesData,
        formInline: {
          name,
          match: row?.match ?? "",
          exclude: row?.exclude ?? false,
          value: row?.value ?? "",
          type: row?.type ?? ""
        }
      },
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      top: "10vh",
      contentRenderer: () => h(addForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const data = options.props.formInline as FormItemProps;
        if (data.name?.length === 2) {
          data.name.unshift("*");
        }
        const FormRef = formRef.value.getRef();
        FormRef.validate(valid => {
          if (valid) {
            ruleInfo.value[`${data.name[1]}__${data.name[2]}__${data.match}`] =
              {
                table: data.name[1],
                field: data.name[2],
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
