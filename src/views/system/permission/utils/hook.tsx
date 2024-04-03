import dayjs from "dayjs";
import {
  createDataPermissionApi,
  deleteDataPermissionApi,
  getDataPermissionDetailApi,
  getDataPermissionListApi,
  manyDeleteDataPermissionApi,
  updateDataPermissionApi
} from "@/api/system/permission";
import { formatOptions } from "@/views/system/hooks";
import { computed, onMounted, reactive, ref, type Ref, shallowRef } from "vue";
import { cloneDeep } from "@pureadmin/utils";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { FieldChoices, ModeChoices } from "@/views/system/constants";
import { handleTree } from "@/utils/tree";
import { getModelLabelFieldListApi } from "@/api/system/field";
import { getMenuPermissionListApi } from "@/api/system/menu";
import type { PlusColumn } from "plus-pro-components";
import Form from "../form.vue";
import { renderSwitch, selectOptions } from "@/views/system/render";

export function useDataPermission(tableRef: Ref) {
  const { t } = useI18n();
  const fieldLookupsData = ref([]);
  const menuPermissionData = ref([]);
  const choicesDict = ref([]);
  const valuesData = ref([]);
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
    mode_type: "",
    is_active: "",
    description: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const defaultValue = cloneDeep(searchForm.value);

  const api = reactive({
    list: getDataPermissionListApi,
    create: createDataPermissionApi,
    delete: deleteDataPermissionApi,
    update: updateDataPermissionApi,
    detail: getDataPermissionDetailApi,
    batchDelete: manyDeleteDataPermissionApi
  });

  const auth = reactive({
    list: hasAuth("list:systemDataPermission"),
    create: hasAuth("create:systemDataPermission"),
    delete: hasAuth("delete:systemDataPermission"),
    update: hasAuth("update:systemDataPermission"),
    detail: hasAuth("detail:systemDataPermission"),
    batchDelete: hasAuth("manyDelete:systemDataPermission")
  });

  const editForm = shallowRef({
    title: t("permission.permission"),
    form: Form,
    row: {
      menu: row => {
        return row?.menu ?? [];
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
      choicesDict: () => {
        return choicesDict.value["mode_type"];
      }
    },
    options: {
      top: "10vh"
    }
  });

  const columns = ref<TableColumnList>([
    {
      label: t("labels.checkColumn"),
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 100
    },
    {
      label: t("permission.name"),
      prop: "name",
      minWidth: 120
    },
    {
      label: t("permission.mode"),
      prop: "mode_display",
      minWidth: 120
    },
    {
      label: t("labels.status"),
      minWidth: 130,
      prop: "is_active",
      cellRenderer: renderSwitch(auth, tableRef, "is_active", scope => {
        return scope.name;
      })
    },
    {
      label: t("labels.description"),
      prop: "description",
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
      label: t("labels.operations"),
      fixed: "right",
      width: 160,
      slot: "operation"
    }
  ]);

  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("permission.name"),
        prop: "name",
        valueType: "input"
      },
      {
        label: t("labels.status"),
        prop: "is_active",
        valueType: "select",
        options: selectOptions
      },
      {
        label: t("permission.mode"),
        prop: "mode_type",
        valueType: "select",
        options: computed(() => {
          return formatOptions(choicesDict.value["mode_type"]);
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

  onMounted(() => {
    api.detail("choices").then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });

    if (hasGlobalAuth("list:systemModelField")) {
      getModelLabelFieldListApi({
        page: 1,
        size: 1000,
        field_type: FieldChoices.DATA
      }).then(res => {
        if (res.code === 1000) {
          fieldLookupsData.value = handleTree(res.data.results);
          valuesData.value = res.choices_dict;
        }
      });
    }
    if (hasGlobalAuth("list:systemMenuPermission")) {
      getMenuPermissionListApi({ page: 1, size: 1000 }).then(res => {
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
    editForm,
    searchForm,
    defaultValue,
    searchColumns
  };
}
