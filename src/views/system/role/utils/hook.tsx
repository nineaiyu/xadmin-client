import { SUCCESS_CODE } from "@/api/types";
import menuFieldForm from "../components/RoleForm.vue";
import RolePermissionPreview from "../components/RolePermissionPreview.vue";
import { addDrawer } from "@/components/ReDrawer";
import { ElLink } from "element-plus";
import { useRouter } from "vue-router";

import {
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef,
  type Ref
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
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import type { PermissionTreeNode } from "./permissionTree";
import type { RecordType } from "plus-pro-components";
import type {
  OperationProps,
  PageTableColumn,
  RePlusPageProps
} from "@/components/RePlusPage";

export function useRole(pageRef?: Ref) {
  const { t } = useI18n();
  const api = reactive(roleApi);
  const router = useRouter();
  // 批量更新需要读取勾选行：页面传入 RePlusPage ref（缺省自带一个，供独立使用）
  const tableRef = pageRef ?? ref();

  const auth = reactive({
    preview: false,
    ...getDefaultAuths(getCurrentInstance(), ["preview"])
  });

  /** 权限预览抽屉（统一走 ReDrawer，不在页面模板手挂 el-drawer） */
  const openPreview = (row: RecordType) => {
    addDrawer({
      title: t("permissionPreview.roleTitle"),
      size: "60%",
      destroyOnClose: true,
      hideFooter: true,
      contentRenderer: () => h(RolePermissionPreview, { row })
    });
  };

  // 授权树节点（菜单树 + 注入的模型字段合成节点，键约定见 ./treeKeys.ts）
  const menuTreeData = ref<PermissionTreeNode[]>([]);
  const fieldLookupsData = ref<Record<string | number, RecordType>>({});

  /**
   * 在绑定了模型的叶子菜单下注入字段权限分组节点：
   * 分组键 `+{fieldPk}`，其子节点为字段叶子键 `{menuPk}+{fieldPk}`
   * （分组仅作展示，字段叶子才计入 role.fields，见 ./treeKeys.ts）。
   */
  function autoFieldTree(arr: PermissionTreeNode[]) {
    arr.forEach(item => {
      if (item.model && item.model.length > 0 && !item.children) {
        const children: PermissionTreeNode[] = [];
        item.children = children;
        item.model.forEach(m => {
          const mPk =
            typeof m === "object" && m !== null
              ? (m as { pk?: string | number }).pk
              : m;
          const data = cloneDeep(
            fieldLookupsData.value[mPk as string]
          ) as PermissionTreeNode;
          if (!data) return;
          data.pk = fieldGroupKey(String(data.pk));
          data.children?.forEach(child => {
            child.pk = menuFieldKey(String(item.pk), String(child.pk));
            child.parent = data.pk;
          });
          children.push(data);
        });
        if (children.length) item.children = children;
      }
      if (item.children) autoFieldTree(item.children);
    });
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
                const tree = handleTree(
                  res.data.results
                ) as PermissionTreeNode[];
                menuTreeData.value = tree;
                autoFieldTree(tree);
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
        field: ({ rawRow }: { rawRow?: RecordType }) => {
          // 列表行 field 为 []（ListRoleSerializer 口径）；编辑态会叠加详情原文，
          // 详情口径是 {menuPk: [fieldPk]} 字典。授权树勾选回显（MenuPermissionTree
          // 的 setCheckedKeys）要的是合成键数组，这里统一归一化（键约定见 ./treeKeys.ts）
          const field = rawRow?.field;
          if (Array.isArray(field)) {
            return field;
          }
          if (field && typeof field === "object") {
            return Object.keys(field).flatMap(menuPk =>
              (field[menuPk] ?? []).map((fieldPk: string | number) =>
                menuFieldKey(menuPk, String(fieldPk))
              )
            );
          }
          return [];
        },
        menu: ({ rawRow }: { rawRow?: RecordType }) => {
          return getKeyList(rawRow?.menu ?? [], "pk") ?? [];
        },
        fields: ({ rawRow }: { rawRow?: RecordType }) => {
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
          column["renderField"] = (
            value: unknown,
            onChange: (val: unknown) => void
          ) => {
            return h(menuFieldForm, {
              api,
              auth,
              pk: formValue?.value?.pk,
              modelValue: value as Array<string | number>,
              field: formValue?.value?.field,
              // 传 ref 而非快照：菜单树晚于弹窗渲染完成时仍能回显勾选
              menuTreeData,
              onChange: ({ fields, menu }) => {
                if (formValue?.value) formValue.value.fields = fields;
                onChange(menu);
              }
            });
          };
          return column;
        }
      },
      minWidth: "860px",
      dialogDrawerOptions: {
        // 授权树节点含类型标签 / 权限码 / 状态标识，宽度不足会被裁剪
        width: "72vw"
      }
    }
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    // 160px 下 3 个按钮（编辑/删除/详情）换行使行高翻倍，200px 单行
    width: 200,
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
          openPreview(row);
        },
        show: auth.preview
      }
    ]
  });
  // 批量更新：勾选行后统一写入同组字段（字段白名单：启用状态）
  const { batchUpdateButton } = useBatchUpdate({
    t,
    api,
    tableRef,
    fields: [
      {
        key: "is_active",
        label: t("commonLabels.is_active"),
        input_type: "boolean"
      }
    ]
  });
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [batchUpdateButton]
  });

  /**
   * 联动：列表「用户数」列（后端关联计数）可点击，跳转到按该角色筛选的用户列表
   * （用户页读取 ?role=<pk> 注入搜索条件并刷新，见 system/user/utils/hook.tsx）
   */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      if (column._column?.key !== "user_count") return;
      column["minWidth"] = 90;
      column["cellRenderer"] = ({ row }) =>
        h(
          ElLink,
          {
            type: "primary",
            underline: false,
            onClick: () =>
              router.push({
                path: "/system/user/index",
                query: { role: String(row.pk) }
              })
          },
          () => String(row.user_count ?? 0)
        );
    });
    return columns;
  };

  return {
    api,
    auth,
    tableRef,
    addOrEditOptions,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
