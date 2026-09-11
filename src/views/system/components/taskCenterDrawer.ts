import { h } from "vue";
import { addDrawer } from "@/components/ReDrawer";
import { transformI18n } from "@/plugins/i18n";

import TaskCenterDrawer from "./TaskCenterDrawer.vue";

/**
 * 打开任务中心聚合抽屉（审批待办 / 进行中任务 / 最近导出 / 最近导入）。
 *
 * 顶栏铃铛与下载中心页共用同一入口，避免"两处各起一份抽屉"后行为漂移。
 */
export function openTaskCenterDrawer() {
  addDrawer({
    // 弹层标题不做自动翻译：显式走 transformI18n（键缺失时回退键名，便于排查）
    title: transformI18n("taskCenter.title"),
    size: "35%",
    destroyOnClose: true,
    closeOnClickModal: true,
    hideFooter: true,
    contentRenderer: () => h(TaskCenterDrawer)
  });
}
