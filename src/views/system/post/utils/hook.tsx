import { shallowRef } from "vue";
import { hasAuth } from "@/router/utils";
import { postApi, type PostItem } from "@/api/identity/post";
import { defineListPage, type OperationProps } from "@/components/RePlusPage";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import { usePostColumns } from "./usePostColumns";
import { usePostButtons } from "./usePostButtons";
import { usePostFormOptions } from "./usePostFormOptions";
import { openPostMembersDialog } from "./postMembersDialog";
import { openPostPreview } from "./postPreview";

/**
 * 岗位管理表格：岗位 CRUD + 成员分配 + 成员数计数。
 *
 * - 新建/编辑走框架元数据表单（后端字段即表单字段），页面只在
 *   `usePostFormOptions` 里定制部门下拉、排序边界与「成员数」只读扩展字段；
 * - 成员分配与预览是页面专属能力，保留 ReDialog 内容组件；
 * - 启停用列渲染为只读标签：编辑入口已在表单内，避免与框架内联开关形成双入口；
 * - 删除保留框架默认入口（自带二次确认；软删除进回收站）。
 */
export function usePosts() {
  return defineListPage({
    api: postApi,
    localeName: "post",
    columns: ({ t, columns }) =>
      usePostColumns({ t }).listColumnsFormat(columns),
    formOptions: ({ t }) => usePostFormOptions({ t }).addOrEditOptions,
    buttons: ({ t, api, tableRef }) => {
      // 只读名录：后端 members(GET)/assign(POST) 双权限点建模（便于只读授权）——
      // 前端成员入口对两种权限都开放，无 assign 时以只读模式打开
      const flags = {
        canAssign: hasAuth("assign:SystemPost"),
        canViewMembers: hasAuth("members:SystemPost"),
        canPreview: hasAuth("preview:SystemPost")
      };

      const refresh = () => tableRef.value?.handleGetData();

      const { operationButtonsProps } = usePostButtons({
        t,
        flags,
        openMembers: (row: PostItem, readonly?: boolean) =>
          openPostMembersDialog({ t, refresh, row, readonly }),
        openPreview: (row: PostItem) => openPostPreview({ t, row })
      });

      // 批量更新：勾选行后统一写入启用状态（此前权限点已授但页面无入口）
      const { batchUpdateButton } = useBatchUpdate({
        t,
        api,
        tableRef,
        canBatch: hasAuth("batchUpdate:SystemPost"),
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

      return { operationButtonsProps, tableBarButtonsProps };
    }
  });
}
