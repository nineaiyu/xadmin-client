import { h, defineComponent } from "vue";
import { Icon as IconifyIcon, addIcon } from "@iconify/vue/dist/offline";

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
    if (typeof this.icon === "object") addIcon(this.icon, this.icon);
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
      return h(
        IconifyIcon,
        {
          icon: this.icon,
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
        this.icon,
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
