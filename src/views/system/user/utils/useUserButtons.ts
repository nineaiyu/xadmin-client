import { useRouter } from "vue-router";
import { shallowRef, type Ref, type UnwrapNestedRefs } from "vue";
import { ElMessageBox } from "element-plus";
import { hasAuth } from "@/router/utils";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/system/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Role from "~icons/ri/admin-line";
import Avatar from "~icons/ri/user-3-fill";
import Password from "~icons/ri/lock-password-line";
import MailSendLine from "~icons/ri/mail-send-line";
import ShieldKeyhole from "~icons/ri/shield-keyhole-line";
import Message from "~icons/ri/message-fill";
import Tag from "~icons/ri/price-tag-3-line";
import Logout from "~icons/ri/logout-circle-r-line";
import View from "~icons/ep/view";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";

type TFunction = ReturnType<typeof useI18n>["t"];

type Row = RecordType;

/** 用户视图批量通知与行操作按钮组（登出/头像/重置密码/授权） */
export function useUserButtons({
  t,
  api,
  auth,
  tableRef,
  selectedNum,
  manySelectData,
  handleUpload,
  handleReset,
  handleRoleRules,
  handlePreview,
  handleImBinding,
  handleTags,
  handleBatchTags
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  auth: {
    logout?: boolean;
    upload?: boolean;
    resetPassword?: boolean;
    empower?: boolean;
    resetMfa?: boolean;
    preview?: boolean;
    imBinding?: boolean;
    invite?: boolean;
  };
  tableRef: Ref;
  selectedNum: Ref<number>;
  manySelectData: Ref<Row[]>;
  handleUpload: (row: Row) => void;
  handleReset: (row: Row) => void;
  handleRoleRules: (row: RecordType) => void;
  handlePreview: (row: RecordType) => void;
  handleImBinding: (row: RecordType) => void;
  handleTags: (row: RecordType) => void;
  handleBatchTags: (pks: string[]) => void;
}) {
  const router = useRouter();
  // 通用标签：打标入口按全局权限点显示（对象级 update 权限由后端复核）
  const canAssignTags = hasAuth("assign:Tag");

  function goNotice() {
    const users: RecordType[] = [];
    manySelectData.value.forEach(user => {
      users.push({
        pk: user.pk,
        username: user.username
      });
    });
    router.push({
      name: "SystemNotice",
      query: { notice_user: JSON.stringify(users) }
    });
  }

  const selectionChange = (data: Row[]) => {
    manySelectData.value = data;
    selectedNum.value = manySelectData.value.length ?? 0;
  };

  /**
   * 邀请激活：发送/重发邀请邮件（重置为待激活 + 密码立即失效）——高危动作二次确认；
   * 已激活账号重发后原密码失效，需重新激活（后端状态机保证非 pending 不可再激活）。
   */
  function handleInvite(row: Row) {
    ElMessageBox.confirm(
      t("systemUser.inviteConfirm"),
      t("systemUser.invite"),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        type: "warning"
      }
    )
      .then(() =>
        handleOperation({
          t,
          apiReq: api.invite(row.pk),
          success() {
            tableRef.value.handleGetData();
          }
        })
      )
      .catch(() => undefined);
  }

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
    buttons: [
      {
        text: t("systemUser.batchSendNotice"),
        code: "batchSendNotice",
        props: {
          type: "primary",
          icon: useRenderIcon(Message),
          plain: true
        },
        onClick: () => {
          goNotice();
        },
        show: () => {
          return Boolean(hasAuth("create:SystemNotice") && selectedNum.value);
        }
      },
      {
        // 批量打标：标签此前只能逐行从「更多」菜单进入，勾选后可一次性追加/移除/替换
        text: t("tag.batchAssignTitle"),
        code: "batchTags",
        props: {
          type: "primary",
          icon: useRenderIcon(Tag),
          plain: true
        },
        onClick: () => {
          handleBatchTags(manySelectData.value.map(item => String(item.pk)));
        },
        show: () => Boolean(canAssignTags && selectedNum.value)
      },
      batchUpdateButton
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 260,
    buttons: [
      {
        text: t("systemUser.logout"),
        code: "logout",
        props: (row, button) => {
          const disabled = row?.online_count === 0;
          return {
            ...(button?._?.props ?? {
              icon: useRenderIcon(Logout),
              link: true
            }),
            ...{ disabled, type: disabled ? "default" : "danger" }
          };
        },
        onClick: ({ row }) => {
          handleOperation({
            t,
            apiReq: api.logout(row.pk, {}),
            success() {
              tableRef.value.handleGetData();
            }
          });
        },
        show: auth.logout
      },
      {
        text: t("systemUser.editAvatar"),
        code: "upload",
        props: {
          type: "primary",
          icon: useRenderIcon(Avatar),
          plain: true,
          link: true
        },
        onClick: ({ row }) => {
          handleUpload(row);
        },
        show: auth.upload
      },
      {
        text: t("systemUser.resetPassword"),
        code: "resetPassword",
        props: {
          type: "primary",
          icon: useRenderIcon(Password),
          link: true
        },
        onClick: ({ row }) => {
          handleReset(row);
        },
        show: auth.resetPassword
      },
      {
        text: t("systemUser.invite"),
        code: "invite",
        props: {
          type: "primary",
          icon: useRenderIcon(MailSendLine),
          link: true
        },
        onClick: ({ row }) => {
          handleInvite(row);
        },
        show: auth.invite
      },
      {
        text: t("systemUser.assignRoles"),
        code: "empower",
        props: {
          type: "primary",
          icon: useRenderIcon(Role),
          link: true
        },
        onClick: ({ row }) => {
          // 表格行动态边界：按 handleRoleRules 所需契约收窄
          handleRoleRules(row as { username: string; [key: string]: unknown });
        },
        show: auth.empower
      },
      {
        text: t("systemUser.preview"),
        code: "preview",
        props: {
          type: "primary",
          icon: useRenderIcon(View),
          link: true
        },
        onClick: ({ row }) => {
          handlePreview(row);
        },
        show: auth.preview
      },
      {
        text: t("systemUser.resetMfa"),
        code: "resetMfa",
        props: {
          type: "danger",
          icon: useRenderIcon(ShieldKeyhole),
          link: true
        },
        onClick: ({ row }) => {
          handleOperation({
            t,
            apiReq: api.resetMfa(row.pk),
            success() {
              tableRef.value.handleGetData();
            }
          });
        },
        show: auth.resetMfa
      },
      {
        text: t("systemUser.imBinding"),
        code: "imBinding",
        props: {
          type: "primary",
          icon: useRenderIcon(Message),
          link: true
        },
        onClick: ({ row }) => {
          handleImBinding(row as RecordType);
        },
        show: auth.imBinding
      },
      {
        text: t("tag.assignTitle"),
        code: "tags",
        props: {
          type: "primary",
          icon: useRenderIcon(Tag),
          link: true
        },
        onClick: ({ row }) => {
          handleTags(row as RecordType);
        },
        show: canAssignTags
      }
    ]
  });

  return { selectionChange, tableBarButtonsProps, operationButtonsProps };
}
