import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { handleTree } from "@/utils/tree";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import { menuApi } from "@/api/system/menu";
import { hasAuth } from "@/router/utils";
import { FieldChoices } from "@/views/system/constants";
import { cloneDeep } from "@pureadmin/utils";
import { modelLabelFieldApi } from "@/api/system/field";
import { fieldGroupKey, menuFieldKey } from "./treeKeys";
import type { PermissionTreeNode } from "./permissionTree";
import type { RecordType } from "plus-pro-components";

/**
 * 角色授权树数据源（菜单权限 + 注入的模型字段合成节点）。
 * 自 useRole 拆出（行为不变）：菜单全量列表与菜单页 / 权限页共用缓存
 * （菜单页为权威刷新方）；绑定了模型的叶子菜单下注入字段分组与字段叶子。
 */
export function useRoleMenuTree() {
  const { t } = useI18n();

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
        // 菜单树先行回填（T02-11）：字段权限缺失或字段接口失败时只损失注入的
        // 字段节点，整树不再空白——原先 menuTreeData 只在「有字段权限 且 字段
        // 接口成功」的嵌套分支赋值，无字段权限的角色页授权树整树不可用
        const tree = handleTree(res.data.results) as PermissionTreeNode[];
        menuTreeData.value = tree;
        if (hasAuth("list:SystemModelLabelField")) {
          fetchAllRows(modelLabelFieldApi.list, {
            field_type: FieldChoices.ROLE
          })
            .then(result => {
              if (result.code === SUCCESS_CODE) {
                result.data.results.forEach(item => {
                  fieldLookupsData.value[item.pk] = item;
                });
                // 原地注入字段分组/叶子节点（menuTreeData 持有同一棵树）
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

  return {
    menuTreeData,
    fieldLookupsData,
    autoFieldTree
  };
}
