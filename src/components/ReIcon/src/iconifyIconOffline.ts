import { h, defineComponent } from "vue";
import { Icon as IconifyIcon, addIcon } from "@iconify/vue/dist/offline";

import { normalizeIconName } from "./iconRegistry";

// Iconify Icon在Vue里本地使用（用于内网环境）
export default defineComponent({
  name: "IconifyIconOffline",
  components: { IconifyIcon },
  props: {
    icon: {
      default: null
    }
  },
  render() {
    if (typeof this.icon === "object") {
      addIcon(this.icon as never, this.icon as never);
    }
    const attrs = this.$attrs as Record<string, unknown>;
    // 装饰性图标默认对读屏隐藏（a11y）；当图标承担交互语义时（如下拉/气泡
    // trigger，Element Plus 会向 vnode 注入 role/tabindex/aria-haspopup 等属性）
    // 自动恢复可访问——aria-hidden 元素可聚焦会触发 axe aria-hidden-focus 违规。
    // 显式传入的 aria-hidden 始终优先（见 RePureTableBar 的显式声明）。
    const interactive =
      attrs?.role != null ||
      attrs?.tabindex != null ||
      attrs?.["aria-label"] != null ||
      attrs?.["aria-haspopup"] != null ||
      attrs?.["aria-expanded"] != null;
    const ariaHidden = attrs?.["aria-hidden"] ?? !interactive;
    if (typeof this.icon === "string") {
      // 离线 Icon 按名精确查存储键（懒加载的图标集只登记 `prefix:name`），
      // 故渲染入口统一归一为冒号形态——代码里的斜杠名（`ep/box`）与元数据的冒号名同源
      return h(
        IconifyIcon,
        {
          icon: normalizeIconName(this.icon),
          "aria-hidden": ariaHidden,
          style: attrs?.style
            ? Object.assign(attrs.style, { outline: "none" })
            : { outline: "none" },
          ...attrs
        },
        {
          default: () => []
        }
      );
    } else {
      return h(
        this.icon as never,
        {
          "aria-hidden": ariaHidden,
          style: attrs?.style
            ? Object.assign(attrs.style, { outline: "none" })
            : { outline: "none" },
          ...attrs
        },
        {
          default: () => []
        }
      );
    }
  }
});
