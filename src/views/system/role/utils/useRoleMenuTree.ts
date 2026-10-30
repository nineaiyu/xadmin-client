import { isSuccess } from "@/api/types";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { handleTree } from "@/utils/tree";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import { menuApi } from "@/api/system/menu";
import { hasAuth } from "@/router/utils";
import { FieldChoices } from "@/views/system/constants";
import { modelLabelFieldApi } from "@/api/system/field";
import { injectFieldNodes } from "./roleFieldTree";
import type { PermissionTreeNode } from "@/components/ReMenuPermissionTree/utils/permissionTree";
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
  // 菜单列表权限缺失：授权树恒为空，页面必须显式提示并禁用保存，
  // 否则在空树上保存会清空角色已有授权
  const menuDenied = ref(!hasAuth("list:SystemMenu"));
  // 菜单列表请求失败（业务码失败 / 网络异常）：与「无权限」同口径禁用保存
  const menuError = ref(false);
  // 字段权限元数据加载失败：授权树缺少字段节点，继续编辑并保存会清空既有字段白名单
  const fieldError = ref(false);

  const getMenuData = () => {
    // 菜单全量列表与菜单页 / 权限页共用缓存；菜单页为权威刷新方（force）
    menuError.value = false;
    fieldError.value = false;
    fetchMetaList(META_KEYS.menu, () => fetchAllRows(menuApi.list))
      .then(res => {
        if (!isSuccess(res)) {
          // 业务失败（权限不足/服务异常）也要给出反馈，否则用户只看到空树
          menuError.value = true;
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          return;
        }
        // 菜单树先行回填：字段权限缺失或字段接口失败时只损失注入的
        // 字段节点，整树不再空白——原先 menuTreeData 只在「有字段权限 且 字段
        // 接口成功」的嵌套分支赋值，无字段权限的角色页授权树整树不可用
        const tree = handleTree(res.data.results) as PermissionTreeNode[];
        menuTreeData.value = tree;
        if (hasAuth("list:SystemModelLabelField")) {
          fetchAllRows(modelLabelFieldApi.list, {
            field_type: FieldChoices.ROLE
          })
            .then(result => {
              if (isSuccess(result)) {
                // 接口返回的是扁平行（parent 引用父级），注入的字段分组直接取
                // rows 的 children 作为字段叶子：传扁平行会让每个分组都渲染成
                // 「已选 0/0」并丢失可勾选的字段节点
                handleTree(result.data.results).forEach(item => {
                  fieldLookupsData.value[item.pk] = item;
                });
                // 原地注入字段分组/叶子节点（menuTreeData 持有同一棵树）
                injectFieldNodes(tree, fieldLookupsData.value);
              } else {
                fieldError.value = true;
                message(`${t("results.failed")}，${result.detail}`, {
                  type: "error"
                });
              }
            })
            .catch(() => {
              fieldError.value = true;
              message(t("systemRole.fieldTreeLoadFailed"), {
                type: "error"
              });
            });
        }
      })
      .catch(() => {
        menuError.value = true;
      });
  };

  onMounted(() => {
    if (!menuDenied.value) {
      getMenuData();
    }
  });

  return {
    menuTreeData,
    fieldLookupsData,
    menuDenied,
    menuError,
    fieldError
  };
}
