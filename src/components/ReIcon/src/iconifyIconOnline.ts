import { h, defineComponent } from "vue";
import { Icon as IconifyIcon } from "@iconify/vue";

// Iconify Icon在Vue里在线使用（用于外网环境）
export default defineComponent({
  name: "IconifyIconOnline",
  components: { IconifyIcon },
  props: {
    icon: {
      type: String,
      default: ""
    }
  },
  render() {
    const attrs = this.$attrs as Record<string, unknown>;
    // 装饰性图标默认对读屏隐藏（a11y）；交互语义（role/tabindex/aria-*）时自动
    // 恢复可访问，避免 aria-hidden 元素可聚焦（axe aria-hidden-focus）；
    // 显式传入的 aria-hidden 优先
    const interactive =
      attrs?.role != null ||
      attrs?.tabindex != null ||
      attrs?.["aria-label"] != null ||
      attrs?.["aria-haspopup"] != null ||
      attrs?.["aria-expanded"] != null;
    return h(
      IconifyIcon,
      {
        icon: `${this.icon}`,
        "aria-hidden": attrs?.["aria-hidden"] ?? !interactive,
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
});
