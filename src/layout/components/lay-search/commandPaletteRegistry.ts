/**
 * 命令面板快捷动作注册表（自 useCommandPalette.ts 抽出）：按权限点过滤
 * （无权限不出现），路由类动作跳转目标见 route 字段，主题类动作就地切换。
 */
export const QUICK_ACTIONS = [
  {
    id: "cmd:ai",
    titleKey: "commandPalette.openAi",
    icon: "ri:robot-2-line",
    auth: "status:AiAssistant",
    route: "/integration/ai/index"
  },
  {
    id: "cmd:task",
    titleKey: "commandPalette.openTaskLog",
    icon: "ri:list-check-2",
    auth: "list:SystemTaskExecution",
    route: "/system/celery/logs/index"
  },
  {
    id: "cmd:tag",
    titleKey: "commandPalette.openTags",
    icon: "ri:price-tag-3-line",
    auth: "list:Tag",
    route: "/system/tag/index"
  },
  {
    id: "cmd:module",
    titleKey: "commandPalette.openModules",
    icon: "ri:apps-2-line",
    auth: "list:SystemModule",
    route: "/system/module/index"
  },
  {
    id: "cmd:theme",
    titleKey: "commandPalette.toggleTheme",
    icon: "ri:sun-line"
  },
  {
    id: "cmd:home",
    titleKey: "commandPalette.backHome",
    icon: "ri:home-4-line",
    route: "/"
  }
];

export type QuickActionItem = (typeof QUICK_ACTIONS)[number];

/** 导航目标：快捷动作 / 菜单结果 / 全局搜索分组 / 历史记录 */
export type NavTarget = {
  key: string;
  kind: "command" | "result" | "global" | "history";
  payload: unknown;
};
