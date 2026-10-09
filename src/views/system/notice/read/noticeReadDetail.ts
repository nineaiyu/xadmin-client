import { h } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { addDialog } from "@/components/ReDialog";
import NoticeShowForm from "@/views/system/components/NoticeShow.vue";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 系统通知详情弹窗（只读展示，行内 notice_info 快照渲染） */
export function openNoticeReadDetail({
  t,
  row
}: {
  t: TFunction;
  row: RecordType;
}) {
  addDialog({
    title: t("noticeRead.showSystemNotice"),
    props: {
      formInline: { ...row.notice_info },
      hasPublish: false
    },
    width: "70%",
    draggable: true,
    fullscreen: deviceDetection(),
    fullscreenIcon: true,
    closeOnClickModal: false,
    hideFooter: true,
    contentRenderer: () => h(NoticeShowForm)
  });
}
