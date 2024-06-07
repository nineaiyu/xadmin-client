import dayjs from "dayjs";
import { dataPermissionApi } from "@/api/system/permission";
import { onMounted, reactive, ref, type Ref, shallowRef } from "vue";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { FieldChoices, ModeChoices } from "@/views/system/constants";
import { handleTree } from "@/utils/tree";
import { modelLabelFieldApi } from "@/api/system/field";
import { menuApi } from "@/api/system/menu";
import Form from "../form.vue";
import { renderOption, renderSwitch } from "@/views/system/render";
import type { PlusColumn } from "plus-pro-components";
import { formatFormColumns, formatOptions } from "@/views/system/hooks";
import { transformI18n } from "@/plugins/i18n";
import { getKeyList } from "@pureadmin/utils";

export function useDataPermission(tableRef: Ref) {
  const { t } = useI18n();
  const fieldLookupsData = ref([]);
  const menuPermissionData = ref([]);
  const choicesDict = ref([]);
  const valuesData = ref([]);

  const api = reactive({
    list: dataPermissionApi.list,
    create: dataPermissionApi.create,
    delete: dataPermissionApi.delete,
    update: dataPermissionApi.patch,
    detail: dataPermissionApi.detail,
    fields: dataPermissionApi.fields,
    choices: dataPermissionApi.choices,
    export: dataPermissionApi.export,
    import: dataPermissionApi.import,
    batchDelete: dataPermissionApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemDataPermission"),
    create: hasAuth("create:systemDataPermission"),
    delete: hasAuth("delete:systemDataPermission"),
    update: hasAuth("update:systemDataPermission"),
    detail: hasAuth("detail:systemDataPermission"),
    fields: hasAuth("fields:systemDataPermission"),
    export: hasAuth("export:systemDataPermission"),
    import: hasAuth("import:systemDataPermission"),
    batchDelete: hasAuth("batchDelete:systemDataPermission")
  });

  const editForm = shallowRef({
    title: t("systemPermission.permission"),
    form: Form,
    row: {
      menu: row => {
        return getKeyList(row?.menu, "pk") ?? [];
      },
      is_active: row => {
        return row?.is_active ?? true;
      },
      rules: row => {
        return row?.rules ?? [];
      },
      mode_type: row => {
        return row?.mode_type ?? ModeChoices.OR;
      }
    },
    props: {
      menuPermissionData: () => {
        return menuPermissionData.value;
      },
      fieldLookupsData: () => {
        return fieldLookupsData.value;
      },
      valuesData: () => {
        return valuesData.value;
      },
      modeChoices: () => {
        return choicesDict.value["mode_type"];
      }
    },
    options: {
      top: "10vh"
    }
  });

  const columns = ref<TableColumnList>([
    {
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      prop: "pk",
      minWidth: 100
    },
    {
      prop: "name",
      minWidth: 120
    },
    {
      prop: "mode_type.label",
      minWidth: 120
    },
    {
      minWidth: 130,
      prop: "is_active",
      cellRenderer: renderSwitch(auth.update, tableRef, "is_active", scope => {
        return scope.row.name;
      })
    },
    {
      prop: "description",
      minWidth: 150
    },
    {
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      fixed: "right",
      width: 160,
      slot: "operation"
    }
  ]);

  onMounted(() => {
    api.choices().then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });

    if (hasGlobalAuth("list:systemModelField")) {
      modelLabelFieldApi
        .list({
          page: 1,
          size: 1000,
          field_type: FieldChoices.DATA
        })
        .then(res => {
          if (res.code === 1000) {
            fieldLookupsData.value = handleTree(res.data.results);
          }
        });
    }
    modelLabelFieldApi.choices().then(res => {
      if (res.code === 1000) {
        valuesData.value = res.choices_dict?.choices;
      }
    });
    if (hasGlobalAuth("permissions:systemMenu")) {
      menuApi.permissions({ page: 1, size: 1000 }).then(res => {
        if (res.code === 1000) {
          menuPermissionData.value = handleTree(res.data.results);
        }
      });
    }
  });

  return {
    t,
    api,
    auth,
    columns,
    editForm
  };
}

export function useDataPermissionForm(props) {
  const { t, te } = useI18n();
  const columns: PlusColumn[] = [
    {
      prop: "name",
      valueType: "input"
    },
    {
      prop: "is_active",
      valueType: "radio",
      renderField: renderOption()
    },
    {
      prop: "mode_type",
      valueType: "select",
      tooltip: t("systemPermission.modeTypeTip"),
      options: formatOptions(props.modeChoices)
    },
    {
      prop: "menu",
      valueType: "cascader",
      tooltip: t("systemPermission.menuTip"),
      fieldProps: {
        props: {
          value: "pk",
          label: "title",
          emitPath: false,
          checkStrictly: false,
          multiple: true
        }
      },
      fieldSlots: {
        default: ({ node, data }) => {
          data.title = transformI18n(data?.title);
          return (
            <>
              <span>{data.title}</span>
              <span v-show={!node.isLeaf}> ({data?.children?.length}) </span>
            </>
          );
        }
      },
      options: props.menuPermissionData
    },
    {
      prop: "description",
      valueType: "textarea"
    },
    {
      prop: "rules",
      hasLabel: false
    }
  ];
  formatFormColumns(props, columns, t, te, "systemPermission");
  return {
    t,
    columns
  };
}
