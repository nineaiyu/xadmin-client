import type { useTags } from "../../../hooks/useTag";
import type { Ref } from "vue";

/** 标签操作上下文：useTags 的切片 + 滚动 hook 的视口定位回调与容器 DOM */
export type TagActionsContext = Pick<
  ReturnType<typeof useTags>,
  | "route"
  | "router"
  | "visible"
  | "multiTags"
  | "tagsViews"
  | "buttonTop"
  | "buttonLeft"
  | "currentSelect"
  | "pureSetting"
  | "closeMenu"
  | "onContentFullScreen"
> & {
  /** 视口定位（useTagScroll），删签/切签后把激活标签滚入可视区 */
  dynamicTagView: () => Promise<void>;
  /** 右键菜单定位基准：tags-view 容器 DOM（模板 ref） */
  containerDom: Ref;
};
