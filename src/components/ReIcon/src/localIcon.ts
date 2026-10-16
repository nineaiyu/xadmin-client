import { defineComponent, h } from "vue";
import IconifyIconOffline from "./iconifyIconOffline";
import {
  ensureIconSet,
  iconPrefixOf,
  isIconAvailable,
  isIconSetSupported,
  supportedIconPrefixes
} from "./iconRegistry";

const warned = new Set<string>();

/**
 * 离线图标渲染（`useRenderIcon` 的字符串分支统一入口）。
 *
 * - 图标已随包注册 → 直接用离线图标组件渲染；
 * - 未注册但前缀内置 → 触发**本地**图标集懒加载（同源 chunk），加载完成后重渲染；
 * - 前缀未内置 → 渲染空并（仅 DEV）告警一次——**不做在线兜底**，保证内网可用且
 *   CSP 下零外部请求（页面层 CSP 的隔离验证会断言核心页零违规，可反向证明）。
 */
export default defineComponent({
  name: "LocalIcon",
  props: {
    icon: {
      type: String,
      default: ""
    }
  },
  setup(props, { attrs }) {
    return () => {
      const name = `${props.icon}`;
      if (!name) return null;
      if (isIconAvailable(name)) {
        return h(
          IconifyIconOffline as never,
          {
            icon: name,
            ...attrs
          } as Record<string, unknown>
        );
      }
      const prefix = iconPrefixOf(name);
      if (isIconSetSupported(prefix)) {
        void ensureIconSet(prefix);
      } else if (import.meta.env.DEV && !warned.has(name)) {
        warned.add(name);
        console.warn(
          `[ReIcon] 图标 "${name}" 未随包内置，离线模式不发起在线请求；` +
            `请改用内置图标名，或在 iconRegistry 的 SET_LOADERS 增加该图标集（当前内置：${supportedIconPrefixes.join(" / ")}）`
        );
      }
      return null;
    };
  }
});
