import { useRouter } from "vue-router";
import { shallowRef, type Ref, type UnwrapNestedRefs } from "vue";
import { hasAuth } from "@/router/utils";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/system/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Role from "~icons/ri/admin-line";
import Avatar from "~icons/ri/user-3-fill";
import Password from "~icons/ri/lock-password-line";
import ShieldKeyhole from "~icons/ri/shield-keyhole-line";
import Message from "~icons/ri/message-fill";
import Logout from "~icons/ri/logout-circle-r-line";

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
  handleRoleRules
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  auth: {
    logout?: boolean;
    upload?: boolean;
    resetPassword?: boolean;
    empower?: boolean;
    resetMfa?: boolean;
  };
  tableRef: Ref;
  selectedNum: Ref<number>;
  manySelectData: Ref<Row[]>;
  handleUpload: (row: Row) => void;
  handleReset: (row: Row) => void;
  handleRoleRules: (row: RecordType) => void;
}) {
  const router = useRouter();

  function goNotice() {
    const users = [];
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

  const selectionChange = data => {
    manySelectData.value = data;
    selectedNum.value = manySelectData.value.length ?? 0;
  };

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
      }
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
      }
    ]
  });

  return { selectionChange, tableBarButtonsProps, operationButtonsProps };
}
