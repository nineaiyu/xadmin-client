import RolePermissionPreview from "../components/RolePermissionPreview.vue";
import { addDrawer } from "@/components/ReDrawer";
import { ElLink } from "element-plus";
import { useRouter } from "vue-router";

import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { roleApi } from "@/api/system/role";
import { usePageAuth } from "@/router/utils";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import View from "~icons/ep/view";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import type { RecordType } from "plus-pro-components";
import {
  formatPageColumns,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { useRoleFormOptions } from "./useRoleFormOptions";
import { useRoleMenuTree } from "./useRoleMenuTree";

export function useRole(pageRef?: Ref) {
  const { t } = useI18n();
  const api = reactive(roleApi);
  const router = useRouter();
  // 批量更新需要读取勾选行：页面传入 RePlusPage ref（缺省自带一个，供独立使用）
  const tableRef = pageRef ?? ref();

  const auth = usePageAuth(["preview"]);

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

  // 授权树数据源：菜单全量缓存 + 模型字段合成节点注入
  const { menuTreeData } = useRoleMenuTree();

  // 新增/编辑弹层：授权树（field/menu/fields 归一化见 roleFormValues.ts，纯函数可单测直测）
  const { addOrEditOptions } = useRoleFormOptions({ api, auth, menuTreeData });

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
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      user_count: column => {
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
      }
    });

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
