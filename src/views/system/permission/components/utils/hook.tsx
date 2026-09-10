import { useI18n } from "vue-i18n";
import type {
  FieldLookupItem,
  FieldLookupNode,
  FieldRuleRow,
  FormItemProps
} from "./types";
import { addDialog } from "@/components/ReDialog/index";
import { h, onMounted, ref } from "vue";
import addForm from "../add.vue";
import { deviceDetection } from "@pureadmin/utils";

export function useFieldRule(
  fieldLookupsData: FieldLookupNode[],
  dataList: FieldRuleRow[],
  valuesData: FieldLookupItem[]
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
  /** 规则身份 key：表__字段__匹配 唯一确定一条规则 */
  const ruleKey = (row?) => `${row?.table}__${row?.field}__${row?.match}`;

  /** 值类型的可读名称（列表直接展示中文语义，而不是 value.user.id 这类类型码） */
  const typeLabel = (value?: string) =>
    valuesData.find(item => item.value === value)?.label ?? value ?? "";

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
      minWidth: 80,
      cellRenderer: ({ row }) =>
        row.exclude
          ? t("systemPermission.excludeExclude")
          : t("systemPermission.excludeInclude")
    },
    {
      label: t("systemPermission.addType"),
      prop: "type",
      minWidth: 120,
      cellRenderer: ({ row }) => typeLabel(row.type)
    },
    {
      label: t("systemPermission.addValue"),
      prop: "value",
      minWidth: 100
    },
    {
      label: t("commonLabels.operation"),
      fixed: "right",
      width: 140,
      slot: "operation"
    }
  ]);

  function handleDelete(row) {
    delete ruleInfo.value[ruleKey(row)];
  }

  /** 复制规则：同构规则（多字段/多表）不必重复走完整配置流程 */
  function handleCopy(row) {
    const base = ruleKey(row);
    let key = `${base}__copy`;
    let index = 2;
    while (ruleInfo.value[key]) {
      key = `${base}__copy${index++}`;
    }
    ruleInfo.value[key] = { ...row };
  }

  function openDialog(row) {
    const name = [row?.table, row?.field];
    if (row?.table !== "*") {
      name.unshift(row?.table?.split(".")[0]);
    }
    // 编辑场景：身份（表/字段/match）可能被改动，成功后须移除旧键，否则会残留成两条规则
    const originalKey = row ? ruleKey(row) : null;
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
            const nextKey = `${data.name[1]}__${data.name[2]}__${data.match}`;
            if (originalKey && originalKey !== nextKey) {
              delete ruleInfo.value[originalKey];
            }
            ruleInfo.value[nextKey] = {
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
    handleCopy,
    ruleInfo
  };
}
