# 布局模式（7 种）

> 定位：导航外壳（侧栏 / 顶栏 / 页签 / 内容区）的布局模式说明——
> 7 种布局的语义、形态约定、判定与渲染落点、切换机制、扩展步骤。

## 一、7 种布局一览

布局标识存于 `$storage.layout.layout`（设置面板 →「布局」→「菜单布局」），7 种形态：

| 布局标识             | 形态                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| `vertical`           | 侧栏（Logo + 完整菜单树）全高 + 顶栏在侧栏右侧（面包屑）              |
| `sidebar-mixed-nav`  | 双列侧栏全高（一级窄列含 Logo + 二级列）+ 顶栏在侧栏右侧              |
| `horizontal`         | 无侧栏，顶栏通栏（Logo + 完整菜单树）                                 |
| `header-sidebar-nav` | 顶栏通栏（Logo + 面包屑，不承载菜单）+ 侧栏排在顶栏下方（完整菜单树） |
| `mix`                | 顶栏通栏（Logo + 一级菜单）+ 侧栏排在顶栏下方（当前一级的子菜单）     |
| `header-mixed-nav`   | 双列侧栏全高 + 顶栏在侧栏右侧（承载一级菜单）                         |
| `full-content`       | 不渲染侧栏 / 顶栏 / 页签条 / 页脚，只显示内容主体                     |

形态要点（骨架约定）：

- **Logo 归属**：`mix` / `header-sidebar-nav` 的 Logo 随顶栏（侧栏排在顶栏下方，
  没有侧栏顶部品牌位）；顶栏被配置隐藏时回落到侧栏，避免品牌位整体消失；
  双列布局的 Logo 在一级窄列（只显示图标），次级列顶部另有一处「图标 + 站点名」
  品牌区；
- **侧栏菜单范围**：`mix` 的侧栏显示「当前一级路由的子菜单」（受「导航切割」
  `navigationSplit` 控制，关闭后回到完整菜单树）；`header-sidebar-nav` 恒为完整菜单树；
  双列菜单（`sidebar-mixed-nav`）的窄列承担全局一级导航、主列显示当前一级的子菜单树；
  混合双列（`header-mixed-nav`）由顶栏承担一级导航，窄列显示「当前一级的子菜单」、
  主列显示「窄列中悬停 / 激活项的 children」（
  无内容时主列整列不渲染、侧栏收为窄列宽度）；
- **侧栏偏移**：侧栏排在顶栏下方的布局（`mix` / `header-sidebar-nav`）以
  **固定头部总高**（顶栏 + 页签条，外壳写入 `--layout-chrome-h`）为起点，与
  「隐藏页签 / 隐藏顶栏 / 全屏内容」三态同源——只按顶栏高度会让侧栏与页签条重叠；
- **无子菜单即隐藏侧栏**：`mix`（切割开启）与 `header-mixed-nav` 在当前一级是
  叶子菜单（如「首页」）时侧栏整块不渲染（顶栏仍有一级菜单可导航）；双列菜单
  （`sidebar-mixed-nav`）不参与该判定——它的一级窄列是唯一导航入口；
- **顶栏菜单条**：`mix` / `header-mixed-nav` 在顶栏渲染一级菜单条（NavMix）；
  `horizontal` 由通栏顶栏组件渲染完整菜单；其余布局的顶栏只有面包屑与动作区；
- **顶栏折叠按钮**：仅 `vertical` 与 `header-mixed-nav` 两种布局在顶栏左侧展示
  侧栏折叠按钮——双列菜单 / 混合菜单 /
  侧边导航的折叠入口在侧栏自身，水平与全屏内容无侧栏；
- **全屏内容**没有顶栏，设置入口回落到右下悬浮球（保证始终有切回其它布局的入口），
  用户模拟横幅保持常驻（安全提示）。

## 二、判定（`src/layout/hooks/layoutModes.ts`）

形态特征全部由纯函数判定（禁止 `layout.includes("...")` 子串判定——历史上
`sidebar-mixed-nav` 命中 `includes("mix")`、`header-sidebar-nav` 两个分支都不命中的事故源）：

| 函数                                  | 语义                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| `normalizeLayoutMode`                 | 归一化（未知 / 空值回落 `vertical`）                        |
| `hasSidebar` / `isSideMode`           | 是否渲染侧栏（水平与全屏内容不渲染）                        |
| `hasHeaderMenu` / `hasNavbarMenu`     | 顶栏是否承载菜单 / 顶栏容器内是否内嵌一级菜单条             |
| `hasNavbarLogo`                       | Logo 是否归属顶栏（`mix` / `header-sidebar-nav`）           |
| `isHeaderFullWidth`                   | 顶栏是否通栏（`horizontal` / `mix` / `header-sidebar-nav`） |
| `isTwoColumnSidebar`                  | 是否双列侧栏（`sidebar-mixed-nav` / `header-mixed-nav`）    |
| `sidebarShowsSubmenu`                 | 侧栏显示子菜单还是完整菜单树（含 `navigationSplit` 开关）   |
| `isFullContent`                       | 全屏内容                                                    |
| `resolveLayoutMode`                   | 移动端强制回落竖排                                          |
| `resolveHeaderMode` / `headerModeTo*` | 顶栏模式四态（static / fixed / auto / auto-scroll）派生     |

## 三、渲染落点（改哪里）

| 区域           | 组件 / 文件                                                                           |
| -------------- | ------------------------------------------------------------------------------------- |
| 外壳编排       | `src/layout/index.vue`（侧栏可见性、顶栏与页签条整块的渲染、全屏内容分支）            |
| 顶栏容器       | `src/layout/components/lay-navbar/index.vue`（品牌区 / 菜单条 / 面包屑三态）          |
| 顶栏品牌区     | `src/layout/components/lay-navbar/NavbarLogo.vue`（Logo 归顶栏的布局）                |
| 顶栏水平菜单条 | `src/layout/components/lay-sidebar/NavMix.vue`（一级菜单；导航切割仅 `mix` 生效）     |
| 通栏顶栏       | `src/layout/components/lay-sidebar/NavHorizontal.vue`（`horizontal`）                 |
| 侧栏主体       | `src/layout/components/lay-sidebar/NavVertical.vue`（单列 / 双列、Logo、折叠）        |
| 侧栏菜单装配   | `src/layout/hooks/useSidebarMenu.ts`（整树 / 子菜单两种数据源）                       |
| 内容区         | `src/layout/components/lay-content/index.vue`（固定头部让位、页脚）                   |
| 样式           | `src/style/sidebar/`（`_common.scss` mixin + 各 `body[layout="..."]` 专属覆盖）       |
| 设置面板       | `src/layout/components/lay-setting/components/SettingMenuLayout.vue`（7 选 1 预览卡） |
| 布局预览图     | 同上文件的 `.layout-preview--*`（承载菜单的区域用主色标识）                           |

## 四、切换机制与持久化

- 切换入口：设置面板 →「布局」→「菜单布局」（7 选 1 预览卡，移动端只保留竖排）；
- 生效链路：`useMenuLayout().setMenuLayout` 写 `$storage.layout` + `document.body[layout]`
  （样式作用域）+ `app store` 布局记忆；
- 持久化：`$storage.layout` 变更由 `siteConfig` 自动保存（600ms 防抖 PATCH 到后端
  `WEB_SITE_CONFIG`），换设备 / 清缓存后仍生效；
- 移动端：`resolveLayoutMode` 强制回落 `vertical`（顶栏与双列侧栏在窄屏下不可用）。

## 五、新增一种布局的步骤

1. `layoutModes.ts`：`LayoutMode` 联合类型 + `LAYOUT_MODES` + 各特征位判定分支；
2. `src/style/sidebar/`：新增 `_<layout>.scss`（`merge-style` include + 形态覆盖）
   并在 `_index.scss` 的 `@use` 列表登记；
3. 组件分支：按需接入 `lay-navbar` / `NavVertical` / `lay-content` 的判定函数；
4. 设置面板：`SettingMenuLayout.vue` 选项 + `.layout-preview--*` 预览图；
5. i18n：`layout.menuLayout*` / `layout.menuLayout*Tip`（zh / en 成对）；
6. 测试：`layoutModes.spec.ts`（特征位）＋ `e2e/layout-preferences.e2e.ts`（切换与形态断言）。

## 六、视觉规格

导航外壳的视觉取值集中在设计令牌里，改令牌即全局生效（无需改组件）：

| 项目                  | 取值                                 | 令牌                                                            |
| --------------------- | ------------------------------------ | --------------------------------------------------------------- |
| 侧栏宽度 / 折叠宽度   | 224 / 60                             | `--sidebar-width` / `--sidebar-collapse-width`                  |
| 双列一级窄列宽度      | 80                                   | `--sidebar-mixed-narrow-width`                                  |
| 顶栏高度              | 50                                   | `--layout-header-h`                                             |
| 页签项高度            | 38                                   | `--layout-tags-item-h`                                          |
| 侧栏菜单项高度        | 42                                   | `--nav-item-height`                                             |
| 顶栏菜单项高度        | 40（顶栏内上下各留 5px）             | `--nav-item-height-horizontal`                                  |
| 菜单层级缩进          | 一级 8 / 二级 32 / 三级 48           | `--nav-item-indent`（公式 16px + level*16px）                   |
| 顶栏菜单项左内距      | 12                                   | `_common.scss` 的 `.horizontal-header` 段                       |
| 菜单激活块圆角 / 内缩 | 8 / 8                                | `--nav-item-radius` / `--nav-item-inset`                        |
| 菜单图标尺寸          | 16（窄列 20）                        | `--nav-item-icon-size` / `--nav-item-icon-size-narrow`          |
| 窄列菜单项形态        | 竖排、9px 内边距、4px 纵距、6px 圆角 | `--nav-item-padding-narrow` / `--nav-item-margin-narrow` 等     |
| 侧栏底色（浅色皮肤）  | 白                                   | `--pure-theme-menu-bg`                                          |
| 一级窄列底色          | 浅色同侧栏 / 深色深一档              | `--sidebar-deep`（深色模式取 `--bg-page`）                      |
| 菜单激活态            | 主色 15% 底 + 主色文字               | `--pure-theme-menu-active-bg` / `--pure-theme-menu-active-text` |
| 窄列激活态            | 浅色主色实心块 + 白字                | `_sidebar-narrow.scss`（深色模式提亮块 + 亮字）                 |
| 菜单悬停底色          | `#f4f4f5` 浅灰                       | `--pure-theme-menu-hover`                                       |
| 顶栏分隔              | 1px 底边框（不用投影）               | `border-bottom`（lay-navbar / `_horizontal.scss`）              |
| 页签条底 / 激活标签   | 浅灰条 + 白底圆角块 + 主色文字       | `--fill-muted` / `--bg-card`                                    |
| 内容区底色            | `#eef2f7`                            | `--bg-page`                                                     |
| 卡片圆角              | 8px                                  | `--radius-lg`（随「圆角」档位缩放）                             |

- 浅色皮肤（`light` / 默认 `default`）走「白底侧栏 + 主色浅底激活块」；
  深色模式（`html.dark`）下浅色皮肤会切换为「深色导航调色」（提亮块 + 前景色文字，
  见 `tokens/semantic.scss` 的 `html.dark[data-theme=...]` 块），避免白底 / 浅灰悬停
  在深色面板上留下白块；9 套深色导航皮肤保留各自底色，激活态统一为「主色 22% 底 + 白字」；
- 「导航风格」档 `plain` 会把激活块收平（`--nav-item-radius` / `--nav-item-inset` /
  `--nav-item-radius-narrow` 归零），仍需「整行铺满」形态时使用；
- 折叠态「悬停临时展开」对全部侧栏布局生效（`vertical` 与两种双列布局均有宽度规则，
  侧栏浮层式回展、内容区不动；`header-mixed-nav` 的窄列独显态无次级列可展开，不参与）；
- 视觉基线（`e2e/visual.e2e.ts`）会随令牌改动失效，需按需 `--update-snapshots` 重录。

## 七、相关测试

- 单测：`src/layout/hooks/__tests__/layoutModes.spec.ts`（模式特征位、导航切割、移动端回落）；
- E2E：`e2e/layout-preferences.e2e.ts`——7 种模式的切换与形态断言（含全屏内容的
  外壳隐藏 + 悬浮球兜底入口）、导航切割开 / 关的菜单范围、双列 / 通栏等几何断言。
