import menuFieldForm from "../form.vue";

import { h, onMounted, reactive, ref, shallowRef } from "vue";
import { roleApi } from "@/api/system/role";
import { handleTree } from "@/utils/tree";
import { menuApi } from "@/api/system/menu";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { FieldChoices } from "@/views/system/constants";
import { cloneDeep, getKeyList } from "@pureadmin/utils";
import { modelLabelFieldApi } from "@/api/system/field";
import type {
  CRUDColumn,
  OperationProps,
  RePlusPageProps
} from "@/components/RePlusCRUD";

export function useApiAuth() {
  const api = reactive(roleApi);
  api.update = api.patch;

  const auth = reactive({
    list: hasAuth("list:systemRole"),
    create: hasAuth("create:systemRole"),
    delete: hasAuth("delete:systemRole"),
    update: hasAuth("update:systemRole"),
    export: hasAuth("export:systemRole"),
    import: hasAuth("import:systemRole"),
    detail: hasAuth("detail:systemRole"),
    batchDelete: hasAuth("batchDelete:systemRole")
  });
  return {
    api,
    auth
  };
}

export function useRole() {
  const { api, auth } = useApiAuth();

  const menuTreeData = ref([]);
  const fieldLookupsData = ref({});

  function autoFieldTree(arr) {
    function deep(arr) {
      arr.forEach(item => {
        if (item.model && item.model.length > 0 && !item.children) {
          item.children = [];
          item.model.forEach(m => {
            let data = cloneDeep(fieldLookupsData.value[m?.pk ?? m]);
            data.pk = `+${data.pk}`;
            data.children.forEach(x => {
              x.pk = `${item.pk}+${x.pk}`;
              x.parent = data.pk;
            });
            item.children.push(data);
          });
        }
        if (item.children) {
          deep(item.children);
        }
      });
    }

    if (Object.keys(fieldLookupsData.value).length) deep(arr);
  }

  /** 菜单权限 */

  const getMenuData = () => {
    menuApi.list({ page: 1, size: 1000 }).then(res => {
      setTimeout(() => {
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

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        field: ({ rawRow }) => {
          return rawRow?.field ?? [];
        },
        menu: ({ rawRow }) => {
          return getKeyList(rawRow?.menu ?? [], "pk") ?? [];
        }
      },
      columns: {
        fields: ({ column }) => {
          column["hideInForm"] = true;
          return column;
        },
        menu: ({ column, formValue }) => {
          column["fieldProps"] = {};
          column["renderField"] = (value, onChange) => {
            return h(menuFieldForm, {
              pk: formValue.value?.pk,
              modelValue: value,
              field: formValue.value?.field,
              menuTreeData: menuTreeData.value,
              onChange: ({ fields, menu }) => {
                formValue.value.fields = fields;
                onChange(menu);
              }
            });
          };
          return column;
        }
      },
      minWidth: "700px",
      dialogOptions: {
        width: "60vw"
      }
    }
  });

  const listColumnsFormat = (columns: CRUDColumn[]) => {
    return columns;
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 160,
    buttons: [{ code: "detail", show: false }]
  });
  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps
  };
}
