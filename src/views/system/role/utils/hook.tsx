import dayjs from "dayjs";
import Form from "../form.vue";

import {
  computed,
  h,
  onMounted,
  reactive,
  ref,
  type Ref,
  shallowRef
} from "vue";
import {
  createRoleApi,
  deleteRoleApi,
  getRoleListApi,
  manyDeleteRoleApi,
  updateRoleApi
} from "@/api/system/role";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { handleTree } from "@/utils/tree";
import type { FormItemProps } from "./types";
import { addDialog } from "@/components/ReDialog";
import { getMenuListApi } from "@/api/system/menu";
import type { PlusColumn } from "plus-pro-components";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { FieldChoices } from "@/views/system/constants";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { getModelLabelFieldListApi } from "@/api/system/field";
import { formatOptions, usePublicHooks } from "@/views/system/hooks";
import { selectOptions } from "@/views/system/render";

export function useRole(tableRef: Ref) {
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
  const searchForm = ref({
    name: "",
    code: "",
    is_active: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const defaultValue = cloneDeep(searchForm.value);

  const api = reactive({
    list: getRoleListApi,
    create: createRoleApi,
    delete: deleteRoleApi,
    update: updateRoleApi,
    batchDelete: manyDeleteRoleApi
  });

  const auth = reactive({
    list: hasAuth("list:systemRole"),
    create: hasAuth("create:systemRole"),
    delete: hasAuth("delete:systemRole"),
    update: hasAuth("update:systemRole"),
    invalid: hasAuth("invalid:systemRole"),
    batchDelete: hasAuth("manyDelete:systemRole")
  });

  const editForm = shallowRef({
    form: Form,
    row: {
      is_active: row => {
        return row?.is_active ?? true;
      },
      access: row => {
        return row?.access ?? false;
      },
      inherit: row => {
        return row?.inherit ?? false;
      }
    }
  });

  const formRef = ref();
  const menuTreeData = ref([]);
  const fieldLookupsData = ref({});
  const loading = ref(true);
  const switchLoadMap = ref({});
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
      label: t("role.name"),
      prop: "name",
      minWidth: 120
    },
    {
      label: t("role.code"),
      prop: "code",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.code}>{row.code}</span>
    },
    {
      label: t("labels.status"),
      minWidth: 130,
      prop: "is_active",
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.active")}
          inactive-text={t("labels.inactive")}
          disabled={!auth.update}
          inline-prompt
          style={switchStyle.value}
          onChange={() =>
            tableRef.value.onChange(scope as any, "is_active", scope.row.name)
          }
        />
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
        label: t("role.name"),
        prop: "name",
        valueType: "input"
      },
      {
        label: t("role.code"),
        prop: "code",
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
      }
    ];
  });

  function openDialog(isAdd = true, row?: FormItemProps) {
    let title = t("buttons.edit");
    if (isAdd) {
      title = t("buttons.add");
    }
    addDialog({
      title: `${title} ${t("role.role")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          name: row?.name ?? "",
          code: row?.code ?? "",
          menu: row?.menu ?? [],
          field: row?.field ?? [],
          is_active: row?.is_active ?? true,
          description: row?.description ?? ""
        },
        menuTreeData: menuTreeData.value,
        showColumns: tableRef.value.showColumns,
        isAdd: isAdd
      },
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(Form, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const TreeRef = formRef.value.getTreeRef();
        const curData = options.props.formInline as FormItemProps;

        function chores(detail) {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          tableRef.value.onSearch(); // 刷新表格数据
        }

        FormRef.validate(valid => {
          if (valid) {
            const menu = TreeRef!.getCheckedKeys(false);
            curData.menu = menu.filter(x => {
              return x.indexOf("+") === -1;
            });
            menu.filter(x => {
              return x.toString().indexOf("+") > -1;
            });
            const fields = {};
            menu.forEach(item => {
              if (item.indexOf("+") > -1 && !item.startsWith("+")) {
                let data = item.split("+");
                let val = fields[data[0]];
                if (!val) {
                  fields[data[0]] = [data[1]];
                } else {
                  fields[data[0]].push(data[1]);
                }
              }
            });
            curData.fields = fields;
            delete curData.field;
            loading.value = true;
            if (isAdd) {
              api.create(curData).then(res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
                loading.value = false;
              });
            } else {
              api.update(curData.pk, curData).then(res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
                loading.value = false;
              });
            }
          }
        });
      }
    });
  }

  function autoFieldTree(arr) {
    function deep(arr) {
      arr.forEach(item => {
        if (item.model && item.model.length > 0 && !item.children) {
          item.children = [];
          item.model.forEach(m => {
            let data = cloneDeep(fieldLookupsData.value[m]);
            data.pk = `+${data.pk}`;
            data.children.forEach(x => {
              x.pk = `${item.pk}+${x.pk}`;
              x.parent = data.pk;
            });
            item.children.push(data);
          });
        }
        item.children && deep(item.children);
      });
    }

    if (Object.keys(fieldLookupsData.value).length) deep(arr);
  }

  /** 菜单权限 */

  const getMenuData = () => {
    loading.value = true;
    getMenuListApi({ page: 1, size: 1000 }).then(res => {
      setTimeout(() => {
        loading.value = false;
        if (res.code === 1000) {
          if (hasGlobalAuth("list:systemModelField")) {
            getModelLabelFieldListApi({
              page: 1,
              size: 1000,
              field_type: FieldChoices.ROLE
            }).then(result => {
              if (result.code === 1000) {
                handleTree(result.data.results).forEach(item => {
                  fieldLookupsData.value[item.pk] = item;
                });
                menuTreeData.value = handleTree(res.data.results);
                autoFieldTree(menuTreeData.value);
              }
            });
          }
        }
      }, 300);
    });
  };

  onMounted(() => {
    if (hasGlobalAuth("list:systemMenu")) {
      getMenuData();
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
    searchColumns,
    openDialog
  };
}
