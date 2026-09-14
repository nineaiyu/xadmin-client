import { SUCCESS_CODE } from "@/api/types";
import menuFieldForm from "../components/RoleForm.vue";

import {
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef
} from "vue";
import { useI18n } from "vue-i18n";
import { roleApi } from "@/api/system/role";
import { message } from "@/utils/message";
import { handleTree } from "@/utils/tree";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import { menuApi } from "@/api/system/menu";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { FieldChoices } from "@/views/system/constants";
import { cloneDeep, getKeyList } from "@pureadmin/utils";
import { modelLabelFieldApi } from "@/api/system/field";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { fieldGroupKey, menuFieldKey } from "./treeKeys";
import View from "~icons/ep/view";
import type { RecordType } from "plus-pro-components";
import type { OperationProps, RePlusPageProps } from "@/components/RePlusPage";

export function useRole() {
  const { t } = useI18n();
  const api = reactive(roleApi);

  const auth = reactive({
    preview: false,
    ...getDefaultAuths(getCurrentInstance(), ["preview"])
  });

  const previewRef = ref<{ open: (row: RecordType) => void } | null>(null);

  // 授权树节点（菜单树 + 注入的模型字段合成节点，键约定见 ./treeKeys.ts）
  const menuTreeData = ref<Array<Record<string, unknown>>>([]);
  const fieldLookupsData = ref({});

  function autoFieldTree(arr) {
    function deep(arr) {
      arr.forEach(item => {
        if (item.model && item.model.length > 0 && !item.children) {
          item.children = [];
          item.model.forEach(m => {
            const data = cloneDeep(fieldLookupsData.value[m?.pk ?? m]);
            data.pk = fieldGroupKey(data.pk);
            data.children.forEach(x => {
              x.pk = menuFieldKey(item.pk, x.pk);
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
    // 菜单全量列表与菜单页 / 权限页共用缓存；菜单页为权威刷新方（force）
    fetchMetaList(META_KEYS.menu, () => fetchAllRows(menuApi.list))
      .then(res => {
        if (res.code !== SUCCESS_CODE) {
          // 业务失败（权限不足/服务异常）也要给出反馈，否则用户只看到空树
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          return;
        }
        if (hasAuth("list:SystemModelLabelField")) {
          fetchAllRows(modelLabelFieldApi.list, {
            field_type: FieldChoices.ROLE
          })
            .then(result => {
              if (result.code === SUCCESS_CODE) {
                handleTree(result.data.results).forEach(item => {
                  fieldLookupsData.value[item.pk] = item;
                });
                menuTreeData.value = handleTree(res.data.results);
                autoFieldTree(menuTreeData.value);
              }
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
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
          // 列表行 field 为 []（ListRoleSerializer 口径）；编辑态会叠加详情原文，
          // 详情口径是 {menuPk: [fieldPk]} 字典。授权树勾选回显（form.vue 的
          // setCheckedKeys）要的是合成键数组，这里统一归一化（键约定见 ./treeKeys.ts）
          const field = rawRow?.field;
          if (Array.isArray(field)) {
            return field;
          }
          if (field && typeof field === "object") {
            return Object.keys(field).flatMap(menuPk =>
              (field[menuPk] ?? []).map(fieldPk =>
                menuFieldKey(menuPk, String(fieldPk))
              )
            );
          }
          return [];
        },
        menu: ({ rawRow }) => {
          return getKeyList(rawRow?.menu ?? [], "pk") ?? [];
        },
        fields: ({ rawRow }) => {
          // 后端 fields 必填：未在授权树勾选任何字段授权时也要带上空字典
          // （空字典 = 该角色无字段权限；编辑态后端对空字典不做替换，保留原权限）
          return rawRow?.fields ?? {};
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
              api,
              auth,
              pk: formValue.value?.pk,
              modelValue: value as Array<string | number>,
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

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 160,
    buttons: [
      { code: "detail", show: false },
      {
        text: t("systemRole.preview"),
        code: "preview",
        props: {
          type: "primary",
          icon: useRenderIcon(View),
          link: true
        },
        onClick: ({ row }) => {
          previewRef.value?.open(row);
        },
        show: auth.preview
      }
    ]
  });
  return {
    api,
    auth,
    addOrEditOptions,
    operationButtonsProps,
    previewRef
  };
}
