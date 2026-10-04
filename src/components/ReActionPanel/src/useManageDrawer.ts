import type { VNode } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";

/**
 * 透传参数的收起包装：先收起抽屉再执行动作（避免抽屉与二级弹窗叠加、
 * 焦点归属混乱）。动作清单的 handlers 在构建期经此包装绑定。
 */
export type WithClosed = <A extends unknown[]>(
  run: (...args: A) => void
) => (...args: A) => void;

/** 实体「管理」抽屉装配配置 */
export interface ManageDrawerConfig {
  /** 抽屉标题（如「管理用户：xadmin」） */
  title: string;
  /** 抽屉宽度；缺省为移动端全屏、桌面 480px */
  size?: string | number;
  /** 其余抽屉选项覆盖（如 closeOnClickModal）；title/size/contentRenderer 之外的键均可覆盖 */
  drawerOptions?: Partial<
    Omit<DrawerOptions, "title" | "size" | "contentRenderer">
  >;
  /**
   * 内容渲染：每次打开时重建（配合 destroyOnClose 保证行快照与状态最新）。
   * `ctx.withClosed` 供动作清单绑定「先收起抽屉再执行」的包装。
   */
  render: (ctx: { withClosed: WithClosed }) => VNode;
}

/**
 * 实体「管理」抽屉统一入口：抽屉装配（默认移动端全屏/桌面 480px、销毁关闭、
 * 隐藏底栏）与「先收起再执行」包装收口于此，页面只产出标题与内容 VNode。
 * 内容 VNode 一般由 ReActionPanel + PanelProfile 组装，见用户/部门等管理页。
 */
export function openManageDrawer({
  title,
  size,
  drawerOptions,
  render
}: ManageDrawerConfig): void {
  const options: DrawerOptions = {
    title,
    size: size ?? (deviceDetection() ? "100%" : "480px"),
    destroyOnClose: true,
    hideFooter: true,
    ...drawerOptions
  };
  const withClosed: WithClosed =
    run =>
    (...args) => {
      closeDrawer(options, 0);
      run(...args);
    };
  options.contentRenderer = () => render({ withClosed });
  addDrawer(options);
}
