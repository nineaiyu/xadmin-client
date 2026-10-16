/**
 * 顶栏铃铛角标的来源拆解（铃铛弹层内展示用）。
 *
 * 角标 = 未读站内信 + 待我审批 + 进行中异步任务 三路相加（见 lay-notice/index.vue）。
 * 站内信那一路在弹层里已由「消息通知 / 系统公告」两个页签直接呈现，因此这里只补
 * 「非站内信」的两路——否则用户点开铃铛只看到站内信，会以为角标数字凭空出现
 * （实测现场：角标 4 = 待审批 1 + 进行中任务 3，弹层却空无一物）。
 */

export type BadgeSourceKey = "pending" | "running";

export interface BadgeSourceItem {
  key: BadgeSourceKey;
  /** i18n 词条键：纯函数不绑定语言，翻译交给渲染层 */
  labelKey: string;
  count: number;
}

/** 非正数 / 非法值一律按 0 处理（计数来自轮询，接口异常时可能是 undefined） */
function toCount(value?: number): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

/**
 * 构建「其他待办」来源列表：计数 > 0 的来源才展示，全为 0 时返回空数组
 * （弹层据此决定是否渲染该区块，无其他待办时保持原有形态）。
 */
export function buildBadgeSources(input: {
  pending?: number;
  running?: number;
}): BadgeSourceItem[] {
  const items: BadgeSourceItem[] = [
    {
      key: "pending",
      labelKey: "taskCenter.pendingApproval",
      count: toCount(input.pending)
    },
    {
      key: "running",
      labelKey: "taskCenter.runningTasks",
      count: toCount(input.running)
    }
  ];
  return items.filter(item => item.count > 0);
}

/** 来源合计 = 角标里「非站内信」的那部分（站点信由弹层页签自行示数） */
export function sumBadgeSources(items: BadgeSourceItem[]): number {
  return items.reduce((total, item) => total + item.count, 0);
}
