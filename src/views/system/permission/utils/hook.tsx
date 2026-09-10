import { dataPermissionApi } from "@/api/system/permission";
import {
  computed,
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef
} from "vue";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { FieldChoices, MenuChoices } from "@/views/system/constants";
import { menuApi } from "@/api/system/menu";
import { handleTree } from "@/utils/tree";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import { modelLabelFieldApi } from "@/api/system/field";
import { transformI18n } from "@/plugins/i18n";
import { getKeyList } from "@pureadmin/utils";
import type { OperationProps, RePlusPageProps } from "@/components/RePlusPage";
import type { FieldRuleRow } from "../components/utils/types";
import filterForm from "../components/index.vue";
import { formatFiledAppParent } from "@/views/system/hooks";

export function useDataPermission() {
  const fieldLookupsData = ref([]);
  const valuesData = ref([]);

  const api = reactive(dataPermissionApi);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance())
  });

  /** 全量菜单行（后端 menu 字段 choices 已截断，改由菜单列表接口取全量） */
  type MenuRow = {
    pk: string;
    parent: { pk: string } | string | null;
    menu_type: { value: number } | number;
    meta: { title?: string } | null;
  };
  const menuTreeData = ref<MenuRow[]>([]);

  const menuTypeOf = (item: MenuRow): number =>
    typeof item.menu_type === "number"
      ? item.menu_type
      : (item.menu_type?.value ?? -1);

  const parentIdOf = (item: MenuRow): string | null =>
    item.parent
      ? typeof item.parent === "string"
        ? item.parent
        : item.parent.pk
      : null;

  /** 可选菜单 = 权限节点及其祖先链（与后端 get_menu_queryset 口径一致） */
  const buildMenuOptions = computed(() => {
    const rows = menuTreeData.value;
    const permissionPks = new Set(
      rows
        .filter(item => menuTypeOf(item) === MenuChoices.PERMISSION)
        .map(item => item.pk)
    );
    const selectable = rows.filter(item => {
      if (permissionPks.has(item.pk)) return true;
      let current = parentIdOf(item);
      while (current) {
        if (permissionPks.has(current)) return true;
        const parent = rows.find(row => row.pk === current);
        current = parent ? parentIdOf(parent) : null;
      }
      return false;
    });
    return handleTree(
      selectable.map(item => ({
        pk: item.pk,
        parent_id: parentIdOf(item),
        title: transformI18n(item.meta?.title)
      })),
      "pk",
      "parent_id"
    );
  });

  onMounted(() => {
    if (hasAuth("list:SystemMenu")) {
      // 菜单全量列表与菜单页 / 角色页共用缓存；菜单页为权威刷新方（force）
      fetchMetaList(META_KEYS.menu, () =>
        menuApi.list({ page: 1, size: 1000 })
      ).then(res => {
        if (res.code === 1000) {
          menuTreeData.value = res.data.results as MenuRow[];
        }
      });
    }
    if (hasAuth("list:SystemModelLabelField")) {
      modelLabelFieldApi
        .list({
          page: 1,
          size: 1000,
          field_type: FieldChoices.DATA
        })
        .then(res => {
          if (res.code === 1000) {
            formatFiledAppParent(res.data.results);
            fieldLookupsData.value = handleTree(res.data.results);
          }
        });
    }
    modelLabelFieldApi.choices().then(res => {
      if (res.code === 1000) {
        valuesData.value = res.choices_dict?.choices;
      }
    });
  });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        menu: ({ rawRow }) => {
          return getKeyList(rawRow?.menu ?? [], "pk") ?? [];
        },
        rules: ({ rawRow }) => {
          return rawRow?.rules ?? [];
        }
      },
      columns: {
        pk: ({ column }) => {
          column["hideInForm"] = true;
          return column;
        },
        menu: ({ column }) => {
          // 后端 menu choices 已被截断，清掉 api-search 表单回退渲染器，
          // 改用全量菜单树构建级联选项（computed，菜单数据就绪后自动重算）
          delete column["renderField"];
          column["options"] = buildMenuOptions;
          column["valueType"] = "cascader";
          column["fieldProps"]["props"] = {
            ...column["fieldProps"]["props"],
            ...{
              value: "pk",
              label: "title",
              emitPath: false,
              checkStrictly: false,
              multiple: true
            }
          };
          column["fieldSlots"] = {
            default: ({ node, data }) => (
              <>
                <span>{data.title}</span>
                <span v-show={!node.isLeaf}> ({data?.children?.length}) </span>
              </>
            )
          };
          return column;
        },
        rules: ({ column }) => {
          column["hasLabel"] = false;
          column["renderField"] = (value, onChange) => {
            return h(filterForm, {
              class: ["overflow-auto"],
              dataList: value as FieldRuleRow[],
              valuesData: valuesData.value,
              ruleList: fieldLookupsData.value,
              onChange
            });
          };
          return column;
        }
      }
    }
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 160,
    buttons: [{ code: "detail", show: false }]
  });
  return {
    api,
    auth,
    addOrEditOptions,
    operationButtonsProps
  };
}
