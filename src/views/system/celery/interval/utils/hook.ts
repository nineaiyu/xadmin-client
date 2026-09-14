import { intervalScheduleApi } from "@/api/system/task";
import { getCurrentInstance, reactive } from "vue";
import { getDefaultAuths } from "@/router/utils";

/**
 * 固定间隔调度管理（django_celery_beat IntervalSchedule）。
 *
 * 列表/表单完全由服务端元数据驱动：period 为 labeled_choice，
 * 行内值形如 {value:"minutes", label:"分钟"}，由 RePlusPage 内置
 * 渲染器直出可读标签，无需前端二次格式化。
 */
export function useTaskInterval() {
  // 权限判断，用于判断是否有该权限
  const api = reactive(intervalScheduleApi);
  const auth = reactive({ ...getDefaultAuths(getCurrentInstance()) });

  return {
    api,
    auth
  };
}
