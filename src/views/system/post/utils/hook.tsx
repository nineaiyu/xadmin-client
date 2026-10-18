import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { postApi, type PostItem } from "@/api/identity/post";
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
export function usePosts(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(postApi);
  const auth = usePageAuth("SystemPost");
  // 只读名录：后端 members(GET)/assign(POST) 双权限点建模（便于只读授权）——
  // 前端成员入口对两种权限都开放，无 assign 时以只读模式打开
  const flags = {
    canAssign: hasAuth("assign:SystemPost"),
    canViewMembers: hasAuth("members:SystemPost"),
    canPreview: hasAuth("preview:SystemPost")
  };

  const refresh = () => tableRef.value?.handleGetData();

  const { listColumnsFormat } = usePostColumns({ t });
  const { addOrEditOptions } = usePostFormOptions({ t });

  const { operationButtonsProps } = usePostButtons({
    t,
    flags,
    openMembers: (row: PostItem, readonly?: boolean) =>
      openPostMembersDialog({ t, refresh, row, readonly }),
    openPreview: (row: PostItem) => openPostPreview({ t, row })
  });

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps
  };
}
