import dayjs from "dayjs";
import Form from "../form.vue";

import { onMounted, reactive, ref, type Ref, shallowRef } from "vue";
import { roleApi } from "@/api/system/role";
import { useI18n } from "vue-i18n";
import { handleTree } from "@/utils/tree";
import { menuApi } from "@/api/system/menu";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { FieldChoices } from "@/views/system/constants";
import { cloneDeep } from "@pureadmin/utils";
import { modelLabelFieldApi } from "@/api/system/field";
import { renderOption, renderSwitch } from "@/views/system/render";
import type { PlusColumn } from "plus-pro-components";
import { formatFormColumns } from "@/views/system/hooks";

export function useApiAuth() {
  const api = reactive({
    list: roleApi.list,
    create: roleApi.create,
    delete: roleApi.delete,
    update: roleApi.update,
    fields: roleApi.fields,
    detail: roleApi.detail,
    batchDelete: roleApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemRole"),
    create: hasAuth("create:systemRole"),
    delete: hasAuth("delete:systemRole"),
    update: hasAuth("update:systemRole"),
    fields: hasAuth("fields:systemRole"),
    detail: hasAuth("detail:systemRole"),
    batchDelete: hasAuth("batchDelete:systemRole")
  });
  return {
    api,
    auth
  };
}

export function useRole(tableRef: Ref) {
  const { t } = useI18n();
  const { api, auth } = useApiAuth();

  const editForm = shallowRef({
    title: t("systemRole.role"),
    form: Form,
    row: {
      is_active: row => {
        return row?.is_active ?? true;
      },
      field: row => {
        return row?.field ?? [];
      },
      menu: row => {
        return row?.menu ?? [];
      }
    },
    props: {
      menuTreeData: () => {
        return menuTreeData.value;
      }
    },
    options: {
      width: "700px"
    }
  });

  const menuTreeData = ref([]);
  const fieldLookupsData = ref({});
  const loading = ref(true);
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
      prop: "code",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.code}>{row.code}</span>
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
    menuApi.list({ page: 1, size: 1000 }).then(res => {
      setTimeout(() => {
        loading.value = false;
        if (res.code === 1000) {
          if (hasGlobalAuth("list:systemModelField")) {
            modelLabelFieldApi
              .list({
                page: 1,
                size: 1000,
                field_type: FieldChoices.ROLE
              })
              .then(result => {
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
    editForm
  };
}

export function useSystemRoleForm(props) {
  const { t, te } = useI18n();
  const columns: PlusColumn[] = [
    {
      prop: "name",
      valueType: "input"
    },
    {
      prop: "code",
      valueType: "input"
    },
    {
      prop: "is_active",
      valueType: "radio",
      renderField: renderOption()
    },
    {
      prop: "description",
      valueType: "textarea"
    },
    {
      prop: "menu",
      valueType: "input"
    }
  ];
  formatFormColumns(props, columns, t, te, "systemRole");
  return {
    t,
    columns
  };
}
