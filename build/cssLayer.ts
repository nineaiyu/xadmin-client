import type { Plugin } from "vite";

/**
 * 与 `src/style/tailwind.css` 首行的层顺序声明**必须逐字符一致**（两处同源）：
 * theme(Tailwind 主题变量) < base(Tailwind base) < el(Element Plus 组件样式)
 * < components < utilities。
 *
 * 把组件库样式压到 utilities 之下，Tailwind 工具类才能覆盖 EP 组件样式；
 * xadmin 的「有意覆写」样式（element-plus / appearance / dark 等）保持无层——
 * 无层样式优先级高于任何 @layer，既有覆写行为不受影响；元素级重置
 * （reset.scss）已入 base 层，避免无层兜底规则反向压过组件库样式。
 */
export const CSS_LAYER_ORDER = "@layer theme, base, el, components, utilities;";

interface CssLayerRule {
  /** 目标层名（需与 CSS_LAYER_ORDER 中的层名一致） */
  layerName: string;
  /** 需要包层的包名（匹配其在 node_modules 下的 css 模块 id） */
  packageName: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 把指定包的 CSS 包进 `@layer`。
 *
 * 组件库 CSS 是无层样式，无层样式在级联中永远压过 @layer 内的 Tailwind 工具类；
 * 包层后由层顺序声明决定优先级，使 Tailwind 工具类可以覆盖组件库样式。
 *
 * 层顺序声明在 `transform` 阶段注入会被产物合并/压缩丢弃（模块里的
 * 「层声明 + @layer 规则」会被拆层），故改在 `generateBundle` 阶段对含该层的
 * CSS 产物统一补在顶部——无论产物加载顺序如何，层优先级都正确。
 */
export function viteCssLayerPlugin(
  rules: CssLayerRule | CssLayerRule[]
): Plugin {
  const list = Array.isArray(rules) ? rules : [rules];
  const matchers = list.map(({ layerName, packageName }) => ({
    layerName,
    regex: new RegExp(`${escapeRegExp(packageName)}[\\\\/].+\\.css$`, "i")
  }));

  return {
    name: "vite-plugin-css-layer",
    enforce: "pre",
    transform(code, id) {
      const [file] = id.split("?", 1);
      if (!file) return;
      const matched = matchers.find(m => m.regex.test(file));
      if (matched) {
        return { code: `@layer ${matched.layerName} {\n${code}\n}`, map: null };
      }
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".css")) {
          continue;
        }
        const css = file.source.toString();
        const matched = matchers.some(m =>
          css.includes(`@layer ${m.layerName}`)
        );
        if (!matched) {
          continue;
        }
        const hasStatement = css
          .replace(/^\uFEFF/, "")
          .trimStart()
          .startsWith(CSS_LAYER_ORDER);
        if (hasStatement) {
          continue;
        }
        file.source = `${CSS_LAYER_ORDER}\n${css}`;
      }
    }
  };
}
