import { h } from "vue";
import { addDialog } from "@/components/ReDialog";
import TaskLogDialog from "./TaskLogDialog.vue";

/**
 * 打开任务/执行记录的实时日志弹窗（WebSocket 增量推送）。
 *
 * 定时任务、执行历史、下载中心三处消费同一弹窗组件与同一尺寸/行为约定，
 * 统一收口避免三份逐字重复的实现各自漂移。
 *
 * @param pk   任务/执行记录主键（弹窗据此订阅 WS 日志流）
 * @param title 弹窗标题（调用方自行拼接 i18n 前缀）
 */
export function openTaskLogDialog(pk: string | number, title: string) {
  addDialog({
    title,
    width: "860px",
    destroyOnClose: true,
    closeOnClickModal: false,
    hideFooter: true,
    props: { pk },
    contentRenderer: () => h(TaskLogDialog)
  });
}
