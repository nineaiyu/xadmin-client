import menuFieldForm from "../components/form.vue";

import {
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef
} from "vue";
import { roleApi } from "@/api/system/role";
import { handleTree } from "@/utils/tree";
import { menuApi } from "@/api/system/menu";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { FieldChoices } from "@/views/system/constants";
import { cloneDeep, getKeyList } from "@pureadmin/utils";
import { modelLabelFieldApi } from "@/api/system/field";
import type {
  PageTableColumn,
  OperationProps,
  RePlusPageProps
} from "@/components/RePlusPage";

export function useRole() {
  const api = reactive(roleApi);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance())
  });

  const menuTreeData = ref([]);
  const fieldLookupsData = ref({});

  function autoFieldTree(arr) {
    function deep(arr) {
      arr.forEach(item => {
        if (item.model && item.model.length > 0 && !item.children) {
          item.children = [];
          item.model.forEach(m => {
            const data = cloneDeep(fieldLookupsData.value[m?.pk ?? m]);
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
          if (hasAuth("list:SystemModelLabelField")) {
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
    if (hasAuth("list:SystemMenu")) {
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
          column["renderField"] = (value: any, onChange) => {
            return h(menuFieldForm, {
              api,
              auth,
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
      dialogDrawerOptions: {
        width: "60vw"
      }
    }
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
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
