import { onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { SortableEvent } from "sortablejs";

/** 拖拽回调载荷：抽出 sortablejs 的常用字段，原始事件经 `evt` 透传 */
export interface SortableDragPayload {
  /** 起始下标（跨列表等场景可能为空） */
  oldIndex?: number;
  /** 目标下标 */
  newIndex?: number;
  /** 原始 sortablejs 事件（需要 item / from / to 等时使用） */
  evt: SortableEvent;
}

export interface UseSortableOptions {
  /** 拖拽手柄选择器（不传则整个子项可拖） */
  handle?: string;
  /** 限定可拖拽子项选择器 */
  draggable?: string;
  /** 过滤不可拖拽项选择器 */
  filter?: string;
  /** 拖拽占位元素样式类 */
  ghostClass?: string;
  /** 动画时长（ms），默认 200 */
  animation?: number;
  /** 统一走鼠标/触摸实现（桌面与移动端行为一致，拖影样式可控） */
  forceFallback?: boolean;
  /** 拖影挂到 body（避免父级 transform/overflow 裁剪） */
  fallbackOnBody?: boolean;
  onStart?: (payload: SortableDragPayload) => void;
  onEnd?: (payload: SortableDragPayload) => void;
  onUpdate?: (payload: SortableDragPayload) => void;
}

interface SortableInstance {
  destroy: () => void;
}

/**
 * 通用拖拽排序 hook：收敛 sortablejs 各处分散调用。
 *
 * - `sortablejs` 经动态 import 加载（按需分片，不进入首屏闭包）；
 * - 目标元素就绪即初始化（`target` 支持 ref / getter / 值），元素变化时自动重挂；
 * - 组件卸载自动销毁；`init`/`destroy` 亦对外暴露，供需要「改挂 / 重挂」的调用点手动驱动。
 *
 * 用法：
 *   useSortable(listRef, { handle: ".drag", onEnd: ({ oldIndex, newIndex }) => {...} });
 */
export function useSortable(
  target: MaybeRefOrGetter<HTMLElement | undefined | null>,
  options: UseSortableOptions = {}
) {
  let instance: SortableInstance | null = null;
  let disposed = false;

  const destroy = () => {
    instance?.destroy();
    instance = null;
  };

  const wrap = (cb?: (payload: SortableDragPayload) => void) =>
    cb
      ? (evt: SortableEvent) =>
          cb({ oldIndex: evt.oldIndex, newIndex: evt.newIndex, evt })
      : undefined;

  const init = async () => {
    if (disposed || instance) return;
    if (!toValue(target)) return;
    const { default: Sortable } = await import("sortablejs");
    // 动态加载期间可能已销毁 / 已由其它路径挂载：二次校验后再创建
    if (disposed || instance) return;
    const el = toValue(target);
    if (!el) return;
    instance = Sortable.create(el, {
      animation: options.animation ?? 200,
      ...(options.handle ? { handle: options.handle } : {}),
      ...(options.draggable ? { draggable: options.draggable } : {}),
      ...(options.filter ? { filter: options.filter } : {}),
      ...(options.ghostClass ? { ghostClass: options.ghostClass } : {}),
      ...(options.forceFallback ? { forceFallback: true } : {}),
      ...(options.fallbackOnBody ? { fallbackOnBody: true } : {}),
      onStart: wrap(options.onStart),
      onEnd: wrap(options.onEnd),
      onUpdate: wrap(options.onUpdate)
    });
  };

  // 目标元素就绪后初始化；flush: post 确保在 DOM 更新完成后读取目标节点
  watch(
    () => toValue(target),
    value => void (value && init()),
    {
      immediate: true,
      flush: "post"
    }
  );

  onBeforeUnmount(() => {
    disposed = true;
    destroy();
  });

  return { init, destroy };
}
