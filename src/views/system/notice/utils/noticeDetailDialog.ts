import { h } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { i18n } from "@/plugins/i18n";
import NoticeShowForm from "@/views/system/components/NoticeShow.vue";
import type { Composer } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

/**
 * 通知详情弹窗（顶栏铃铛未读点击 / 站内信推送点击共用形态）。
 *
 * 直接以行快照渲染只读详情，不跳转「我的通知」页：右上角推送弹窗与
 * 铃铛内点击的行为保持一致。推送帧（NoticeMessageSerializer 的
 * pk/level/title/notice_type/message）与铃铛未读列表行同构，
 * 均可直接作为 formInline 复用 NoticeShowForm。
 */
export function openNoticeDetailDialog(row: RecordType) {
  // legacy: false 下 global 收窄为 Composer（I18n 类型的 global 是联合）
  const title = (i18n.global as Composer).t("userNotice.showSystemNotice");
  addDialog({
    title,
    props: {
      formInline: { ...row },
      hasPublish: false
    },
    width: dialogSize("xl"),
    draggable: true,
    fullscreen: deviceDetection(),
    fullscreenIcon: true,
    closeOnClickModal: false,
    hideFooter: true,
    contentRenderer: () => h(NoticeShowForm)
  });
}
