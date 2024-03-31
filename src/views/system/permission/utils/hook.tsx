import dayjs from "dayjs";
import { message } from "@/utils/message";
import {
  createDataPermissionApi,
  deleteDataPermissionApi,
  getDataPermissionDetailApi,
  getDataPermissionListApi,
  manyDeleteDataPermissionApi,
  updateDataPermissionApi
} from "@/api/system/permission";
import { formatOptions, usePublicHooks } from "@/views/system/hooks";
import { addDialog } from "@/components/ReDialog";
import type { FormItemProps } from "./types";
import { computed, h, onMounted, reactive, ref, type Ref } from "vue";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { FieldChoices, ModeChoices } from "@/views/system/constants";
import { handleTree } from "@/utils/tree";
import { getModelLabelFieldListApi } from "@/api/system/field";
import { getMenuPermissionListApi } from "@/api/system/menu";
import type { PlusColumn } from "plus-pro-components";
import editForm from "../form.vue";
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

  const formRef = ref();

  const { switchStyle } = usePublicHooks();

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
      cellRenderer: renderSwitch(
        auth,
        tableRef,
        switchStyle,
        "is_active",
        scope => {
          return scope.name;
        }
      )
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
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      },
      {
        label: t("permission.mode"),
        prop: "mode_type",
        valueType: "select",
        options: formatOptions(choicesDict.value["mode_type"])
      }
    ];
  });

  function openDialog(isAdd = true, row?: FormItemProps) {
    let title = t("buttons.edit");
    if (isAdd) {
      title = t("buttons.add");
    }
    addDialog({
      title: `${title} ${t("permission.permission")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          name: row?.name ?? "",
          menu: row?.menu ?? [],
          rules: row?.rules ?? [],
          mode_type: row?.mode_type ?? ModeChoices.OR,
          is_active: row?.is_active ?? true,
          description: row?.description ?? ""
        },
        menuPermissionData: menuPermissionData.value,
        fieldLookupsData: fieldLookupsData.value,
        valuesData: valuesData.value,
        choicesDict: choicesDict.value["mode_type"],
        showColumns: tableRef.value.showColumns,
        isAdd: isAdd
      },
      width: "50%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      top: "10vh",
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;

        function chores(detail) {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          tableRef.value.onSearch(); // 刷新表格数据
        }
        FormRef.validate(valid => {
          if (valid) {
            if (curData.rules.length === 0) {
              message(`${t("permission.rulesFailed")}`, {
                type: "error"
              });
              return;
            }
            if (isAdd) {
              api.create(curData).then(async res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              api.update(curData.pk, curData).then(async res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            }
          }
        });
      }
    });
  }

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
    searchForm,
    defaultValue,
    searchColumns,
    openDialog
  };
}
