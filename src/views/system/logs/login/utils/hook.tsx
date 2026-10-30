import { useI18n } from "vue-i18n";
import { loginLogApi } from "@/api/audit/logs/login";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { shallowRef } from "vue";
import { goUserDetail, usePublicHooks } from "@/views/system/hooks";
import {
  defineListPage,
  type OperationProps,
  handleOperation
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useConfirm } from "@/hooks/useConfirm";
import Logout from "~icons/ri/logout-circle-r-line";
import {
  canForceLogout,
  onlineSessionsQuery,
  showSessionManage
} from "./loginLogActions";
import { buildLoginLogColumns } from "./loginLogColumns";

export function useLoginLog() {
  // 纯 HTTP 会话不产生 WS channel，本页踢不掉：给一个跳在线会话页的入口
  const { te } = useI18n();
  const canViewOnline = hasAuth("list:SystemUserOnline");

  const router = useRouter();
  const confirm = useConfirm();
  const { tagStyle } = usePublicHooks();

  const page = defineListPage({
    api: loginLogApi,
    localeName: "logsLogin",
    extraAuth: ["logout"],
    buttons: ({ t, api, auth, tableRef }) => ({
      operationButtonsProps: shallowRef<OperationProps>({
        width: 180,
        buttons: [
          {
            text: t("systemUser.logout"),
            code: "logout",
            props: (_row, button) => ({
              ...(button?._?.props ?? {
                icon: useRenderIcon(Logout),
                plain: true,
                link: true
              }), // button?._ 这个表示之前老的按钮信息
              type: "danger"
            }),
            onClick: async ({ row, loading }) => {
              const username = row?.creator?.username ?? "";
              if (
                !(await confirm(
                  t("logsLogin.forceLogoutConfirm", { user: username })
                ))
              ) {
                return;
              }
              loading.value = true;
              handleOperation({
                t,
                apiReq: api.logout(row.pk, {}),
                success() {
                  tableRef.value.handleGetData();
                },
                requestEnd() {
                  loading.value = false;
                }
              });
            },
            // 只有 WS 在线会话能按 channel 踢线；其余行改给「会话管理」入口
            show: row => canForceLogout(auth, row)
          },
          {
            text: t("logsLogin.sessionManage"),
            code: "sessionManage",
            show: row => showSessionManage(canViewOnline, row),
            onClick: ({ row }) =>
              router.push({
                path: "/system/online/index",
                query: onlineSessionsQuery(row)
              })
          }
        ]
      })
    })
  });
  const { t, api } = page;

  /** 详情入口消费 retrieve 权限：按主键取完整行，而不是仅展示列表快照 */
  const detailRowFetch = (row: Record<string, unknown>) =>
    api.retrieve(String(row.pk ?? "")).then(res => res.data);

  const listColumnsFormat = buildLoginLogColumns({
    t,
    te,
    tagStyle,
    onGoDetail: row => goUserDetail(router, row?.creator?.pk)
  });

  return {
    ...page,
    detailRowFetch,
    listColumnsFormat
  };
}
