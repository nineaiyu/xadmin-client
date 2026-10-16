import { unref, type Ref } from "vue";
import { hasClass, toggleClass } from "@pureadmin/utils";

/**
 * 标签 hover 动效（自 useTag.ts 抽取）：鼠标移入/移出时切换卡片进出场类名，
 * 智能风格（smart）使用 schedule-* 命名空间。
 */
export function createTagHoverHandlers({
  instance,
  activeIndex,
  tagsStyle
}: {
  instance: { refs?: unknown } | null;
  activeIndex: Ref<number>;
  tagsStyle: Ref<string>;
}) {
  /** 取标签元素（模板 ref 数组；运行时该 ref 必然存在，类型层做兜底断言） */
  function getTagEl(prefix: string, index: number): HTMLElement {
    const refs = instance?.refs as Record<string, HTMLElement[]> | undefined;
    return refs?.[prefix + index]?.[0] as HTMLElement;
  }

  function onMouseenter(index: number) {
    if (index) activeIndex.value = index;
    if (unref(tagsStyle) === "smart") {
      if (hasClass(getTagEl("schedule", index), "schedule-active")) return;
      toggleClass(true, "schedule-in", getTagEl("schedule", index));
      toggleClass(false, "schedule-out", getTagEl("schedule", index));
    } else {
      if (hasClass(getTagEl("dynamic", index), "is-active")) return;
      toggleClass(true, "card-in", getTagEl("dynamic", index));
      toggleClass(false, "card-out", getTagEl("dynamic", index));
    }
  }

  function onMouseleave(index: number) {
    activeIndex.value = -1;
    if (unref(tagsStyle) === "smart") {
      if (hasClass(getTagEl("schedule", index), "schedule-active")) return;
      toggleClass(false, "schedule-in", getTagEl("schedule", index));
      toggleClass(true, "schedule-out", getTagEl("schedule", index));
    } else {
      if (hasClass(getTagEl("dynamic", index), "is-active")) return;
      toggleClass(false, "card-in", getTagEl("dynamic", index));
      toggleClass(true, "card-out", getTagEl("dynamic", index));
    }
  }

  return { getTagEl, onMouseenter, onMouseleave };
}
