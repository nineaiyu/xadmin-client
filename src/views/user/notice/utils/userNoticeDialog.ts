import { h } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { deviceDetection } from "@pureadmin/utils";
import NoticeShowForm from "@/views/system/components/NoticeShow.vue";
import type { userNoticeReadApi } from "@/api/user/notice";
import type { Ref, UnwrapNestedRefs } from "vue";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 就地改写地址栏去掉 pk 参数（绕过 vue-router）：主内容组件以 fullPath 为 key，
 * 走 router.replace 会整页重挂载、把刚打开的详情弹窗卸载。
 */
function stripPkFromAddressBar() {
  const hash = location.hash;
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) return;
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  if (!params.has("pk")) return;
  params.delete("pk");
  const search = params.toString();
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${location.search}${hash.slice(0, queryIndex)}${
      search ? `?${search}` : ""
    }`
  );
}

/**
 * 通知详情弹窗（自 hook.tsx 抽出）：行内就地已读 + 深链 pk 消费 + 关闭后刷新。
 */
export function createUserNoticeDialog({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userNoticeReadApi>;
  tableRef: Ref;
}) {
  return (
    row: RecordType,
    routeParams: RecordType | null = null,
    searchFields: Ref<RecordType> | null = null
  ) => {
    if (row.unread) {
      // 行内就地已读：失败不阻断弹窗（关闭时列表会刷新）；业务码失败点名提示，
      // HTTP 层异常交由拦截器
      api
        .batchRead({ pks: [row.pk] })
        .then(res => {
          if (res.code !== SUCCESS_CODE) {
            message(String(res.detail || t("userNotice.readFailed")), {
              type: "warning"
            });
          }
        })
        .catch(() => undefined);
    }
    if (routeParams?.pk) {
      // 深链 pk 只消费一次：打开即从地址栏移除，刷新/重开页签不再重复弹出。
      // 铃铛未读点击已改为就地弹窗（不产生 ?pk=），此路径仅兼容历史书签与旧页签。
      stripPkFromAddressBar();
    }
    addDialog({
      title: t("userNotice.showSystemNotice"),
      props: {
        formInline: { ...row },
        hasPublish: false
      },
      // 通知为长文本查看：走弹窗尺寸档位最大档（尺寸治理收敛，不再用百分比散值）
      width: dialogSize("xl"),
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(NoticeShowForm),
      closeCallBack: () => {
        if (routeParams?.pk && searchFields) {
          // 深链进入时列表被 pk 过滤为单条：关闭后清除过滤并重取完整列表
          searchFields.value.pk = "";
          tableRef.value.handleGetData();
          return;
        }
        if (row.unread) {
          tableRef.value.handleGetData();
        }
      }
    });
  };
}
