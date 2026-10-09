import { useRouter } from "vue-router";
import { useConfirm } from "@/hooks/useConfirm";
import { handleOperation } from "@/components/RePlusPage";
import { useUserStoreHook } from "@/store/modules/user";
import type { Ref, UnwrapNestedRefs } from "vue";
import type { userApi } from "@/api/system/user";
import type { TokenInfo } from "@/api/auth";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 用户行级动作（自 hook.tsx 抽出）：重置 MFA / 强制下线 / 发送通知 /
 * 邀请激活 / 模拟用户。邀请与模拟为高危动作（二次确认）；模拟成功换签后
 * 整页刷新以目标身份重建路由/权限/WS。
 */
export function useUserRowHandlers({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  tableRef: Ref;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const refresh = () => tableRef.value.handleGetData();

  /** 重置 MFA：清除动态口令与 Passkey 绑定，用户下次登录需重新绑定 */
  function handleResetMfa(row: RecordType) {
    handleOperation({
      t,
      apiReq: api.resetMfa(row.pk),
      success() {
        refresh();
      }
    });
  }

  /** 强制下线：终止该用户全部在线会话 */
  function handleLogout(row: RecordType) {
    handleOperation({
      t,
      apiReq: api.logout(row.pk, {}),
      success() {
        refresh();
      }
    });
  }

  /** 单行发送通知：跳转通知公告并预填收件人（与工具栏批量入口同参数口径） */
  function handleSendNotice(row: RecordType) {
    router.push({
      name: "SystemNotice",
      query: {
        notice_user: JSON.stringify([{ pk: row.pk, username: row.username }])
      }
    });
  }

  /**
   * 邀请激活：发送/重发邀请邮件（重置为待激活 + 密码立即失效）——高危动作二次确认；
   * 已激活账号重发后原密码失效，需重新激活（后端状态机保证非 pending 不可再激活）。
   */
  function handleInvite(row: RecordType) {
    confirm(t("systemUser.inviteConfirm"), {
      title: t("systemUser.invite")
    }).then(ok => {
      if (ok)
        handleOperation({
          t,
          apiReq: api.invite(row.pk),
          success() {
            refresh();
          }
        });
    });
  }

  /**
   * 模拟用户：签发该用户的 token 并以其身份使用后台。
   * 高危动作二次确认（后端另有 impersonate 权限点 + 密码二次确认）；
   * 成功后 token 已换签，整页刷新以目标身份重建路由/权限/WS。
   */
  function handleImpersonate(row: RecordType) {
    confirm(t("systemUser.impersonateConfirm", { user: row.username }), {
      title: t("systemUser.impersonate")
    }).then(ok => {
      if (ok)
        handleOperation({
          t,
          apiReq: api.impersonate(row.pk as string | number),
          showSuccessMsg: false,
          success(res) {
            // 换签目标身份 token 后整页刷新（switchIdentity 内部处理）
            if (res?.data) {
              useUserStoreHook().switchIdentity(res.data as TokenInfo);
            }
          }
        });
    });
  }

  return {
    handleResetMfa,
    handleLogout,
    handleSendNotice,
    handleInvite,
    handleImpersonate
  };
}
