import type { Emitter } from "mitt";
import mitt from "mitt";

/** 全局公共事件需要在此处添加类型 */
type Events = {
  openPanel: string;
  tagOnClick: string;
  logoChange: boolean;
  tagViewsChange: boolean;
  changLayoutRoute: string;
  tagViewsTagsStyle: string;
  /** 「自动检查更新」开关切换（设置面板 →「关于」），驱动后台轮询启停 */
  checkUpdatesChange: boolean;
  imageInfo: {
    img: HTMLImageElement;
    height: number;
    width: number;
    x: number;
    y: number;
  };
};

export const emitter: Emitter<Events> = mitt<Events>();
