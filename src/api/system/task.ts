import { BaseApi } from "@/api/base";

/** 定时任务管理（django_celery_beat） */
export const periodicTaskApi = new BaseApi("/api/system/tasks/periodic");
export const crontabScheduleApi = new BaseApi("/api/system/tasks/crontab");
export const intervalScheduleApi = new BaseApi("/api/system/tasks/interval");
