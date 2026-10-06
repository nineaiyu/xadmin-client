import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { addDrawer } from "@/components/ReDrawer";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth, usePageAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { formatPageColumns } from "@/components/RePlusPage";
import { postApi, type PostItem } from "@/api/system/post";
import PostForm from "../components/PostForm.vue";
import PostMembersDialog from "../components/PostMembersDialog.vue";
import PostPermissionPreview from "../components/PostPermissionPreview.vue";

/**
 * 岗位管理表格：岗位 CRUD + 成员分配 + 成员数计数。
 *
 * - 新建/编辑/成员分配统一走 ReDialog + 内容组件（C5 方案 B：关闭框架默认
 *   create/update/partialUpdate 按钮）；
 * - 启停用列渲染为只读标签（关闭 partialUpdate 后框架的开关恒禁用，避免双入口）；
 * - 删除保留框架默认入口（自带二次确认；软删除进回收站）。
 */
export function usePosts(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(postApi);
  const auth = usePageAuth("SystemPost");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const canCreate = hasAuth("create:SystemPost");
  const canEdit = hasAuth("partialUpdate:SystemPost");
  const canAssign = hasAuth("assign:SystemPost");
  const canPreview = hasAuth("preview:SystemPost");

  const refresh = () => tableRef.value?.handleGetData();

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      is_active: column => {
        column["cellRenderer"] = ({ row }) =>
          (row as PostItem).is_active
            ? h(ElTag, { size: "small", type: "success" }, () =>
                t("post.enabled")
              )
            : h(ElTag, { size: "small", type: "info" }, () =>
                t("post.disabled")
              );
      },
      user_count: column => {
        column["cellRenderer"] = ({ row }) =>
          h(ElTag, { size: "small", type: "primary" }, () =>
            String((row as PostItem).user_count ?? 0)
          );
      }
    });

  /* ---------------- 新建 / 编辑（ReDialog + PostForm） ---------------- */
  const formRef = ref<InstanceType<typeof PostForm>>();

  const openDialog = (row: PostItem | null) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("post.edit") : t("post.create"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(PostForm, { ref: formRef, row }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免 beforeSure 抛错导致弹窗 loading 悬挂
        const res = await (
          row ? postApi.partialUpdate(row.pk, payload) : postApi.create(payload)
        ).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          message(t("post.saveOk"), { type: "success" });
          done();
          refresh();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  /* ---------------- 成员分配（ReDialog + PostMembersDialog） ---------------- */
  const membersRef = ref<InstanceType<typeof PostMembersDialog>>();

  const openMembers = (row: PostItem) => {
    membersRef.value = undefined;
    addDialog({
      title: `${t("post.members")}：${row.name}`,
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(PostMembersDialog, { ref: membersRef, row }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = membersRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        const res = await postApi.assign(row.pk, payload).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          message(t("post.memberSaveOk"), { type: "success" });
          done();
          refresh();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  /* ---------------- 维度预览（ReDrawer + PostPermissionPreview） ---------------- */

  /** 岗位预览抽屉（与角色/部门预览同体系：ReDrawer，不在页面模板手挂 el-drawer） */
  const openPreview = (row: PostItem) => {
    addDrawer({
      title: t("permissionPreview.postTitle"),
      size: "60%",
      destroyOnClose: true,
      hideFooter: true,
      contentRenderer: () => h(PostPermissionPreview, { row })
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 220,
    buttons: [
      {
        text: t("post.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as PostItem),
        show: canEdit,
        index: 10
      },
      {
        text: t("post.members"),
        code: "members",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openMembers(row as PostItem),
        show: canAssign,
        index: 9
      },
      {
        text: t("post.preview"),
        code: "preview",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openPreview(row as PostItem),
        show: canPreview,
        index: 8
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("post.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
