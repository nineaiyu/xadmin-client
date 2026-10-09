import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { postApi, type PostItem } from "@/api/system/post";
import { usePostButtons } from "./usePostButtons";
import { usePostColumns } from "./usePostColumns";
import { openPostFormDialog } from "./postFormDialog";
import { openPostMembersDialog } from "./postMembersDialog";
import { openPostPreview } from "./postPreview";

/**
 * 岗位管理表格：岗位 CRUD + 成员分配 + 成员数计数。
 *
 * - 新建/编辑/成员分配统一走 ReDialog + 内容组件（C5 方案 B：关闭框架默认
 *   create/update/partialUpdate 按钮）；
 * - 启停用列渲染为只读标签（关闭 partialUpdate 后框架的开关恒禁用，避免双入口）；
 * - 删除保留框架默认入口（自带二次确认；软删除进回收站）。
 *
 * 职责拆分：usePostColumns 列渲染 / usePostButtons 按钮装配 /
 * postFormDialog、postMembersDialog、postPreview 三个弹层。
 */
export function usePosts(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(postApi);
  const auth = usePageAuth("SystemPost");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  // 只读名录：后端 members(GET)/assign(POST) 双权限点建模（便于只读授权）——
  // 前端成员入口对两种权限都开放，无 assign 时以只读模式打开
  const flags = {
    canCreate: hasAuth("create:SystemPost"),
    canEdit: hasAuth("partialUpdate:SystemPost"),
    canAssign: hasAuth("assign:SystemPost"),
    canViewMembers: hasAuth("members:SystemPost"),
    canPreview: hasAuth("preview:SystemPost")
  };

  const refresh = () => tableRef.value?.handleGetData();

  const { listColumnsFormat } = usePostColumns({ t });

  const { tableBarButtonsProps, operationButtonsProps } = usePostButtons({
    t,
    flags,
    openDialog: (row: PostItem | null) =>
      openPostFormDialog({ t, refresh, row }),
    openMembers: (row: PostItem, readonly?: boolean) =>
      openPostMembersDialog({ t, refresh, row, readonly }),
    openPreview: (row: PostItem) => openPostPreview({ t, row })
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
