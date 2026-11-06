# 精致化 UI 规范（4.2 观感 × 5.0 令牌体系）

> 本文是 [ui-4.2-vs-5.0-audit.md](ui-4.2-vs-5.0-audit.md) 的整改规范：
> 在**保留 5.0 令牌体系与 a11y 收益**的前提下，恢复 4.2 被用户认可的
> 「层次感与呼吸感」。所有推荐值都已对齐现有令牌命名，
> 落地即改令牌值/组件样式，不新造机制。
> 评审用并排预览：[ui-4.2-vs-5.0-preview.html](ui-4.2-vs-5.0-preview.html)。

## 零、三个需要先拍板的开放项

整改前先用预览页定夺（影响后续所有阶段的口径）：

| 开放项       | 方案 A（回退）                          | 方案 B（折中，**推荐**）                                                               | 方案 C（维持） |
| ------------ | --------------------------------------- | -------------------------------------------------------------------------------------- | -------------- |
| 主色         | `#409EFF`（鲜亮，但白字 2.8:1 不达 AA） | **维持 `#006BE6`**（4.9:1 达标），激活块/按钮用实心补偿鲜亮感                          | 同 B           |
| 全局圆角     | 4px（EP 原生）                          | **控件 6px（`--el-border-radius-base → --radius-md`）+ 容器/卡片 8px**（外大内小同心） | 8px            |
| 菜单激活形态 | 实心主色块+白字                         | **实心主色块+白字（默认）**；15% tint 保留为「导航风格=朴素」偏好档                    | 15% tint       |

> 主色推荐 B 的理由：`#006BE6` 白字对比 4.9:1 恰好达标，回退 `#409EFF` 会把
> 按钮白字重新拖到 2.8:1（倒退）；4.2 的「鲜亮感」应通过**实心激活块、
> 表头灰带、hover 提亮**这些结构性手段找回，而不是牺牲对比度。

## 一、设计令牌表（推荐值）

### 1.1 层次与阴影（浅色模式的「可读性预算」）

| 令牌                | 现值                                    | 推荐值                                                             | 理由                                                                 |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `--card-border`     | `1px solid --border-lighter`（#ebeef5） | `1px solid --border-light`（#e4e7ed）                              | 白底卡描边必须肉眼可读；#ebeef5 在 #eef2f7 页底上明度差仅 ~2%        |
| `--shadow-card`     | `0 1px 2px hsl(220 30% 20% / 6%)`       | `0 1px 2px hsl(220 30% 20% / 7%), 0 2px 8px hsl(220 30% 20% / 5%)` | 单层 1px 接触阴影太弱；补第二层 2px 扩散，恢复「纸贴在桌上」而不悬浮 |
| 页底 `--bg-page`    | `#eef2f7`                               | 维持                                                               | 与卡面保持 ~5% 明度差（历史口径）                                    |
| `--el-card-padding` | 24px                                    | 维持                                                               | 4.2 是 20px，24 更透气                                               |

### 1.2 密度（关键回退区）

| 令牌/规则                      | 现值                                                      | 推荐值                                                           | 理由                                                                                               |
| ------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| html 基准行高（reset.scss）    | 1.15                                                      | **1.5**                                                          | 1.15 是控件口径；正文恢复 4.2 呼吸感。控件行高由 EP 变量自持，不受影响                             |
| 菜单项高 `--nav-item-height`   | 42px                                                      | **46px**                                                         | 50（4.2）→42 过紧；46 为折中，配合图标 18px 视觉居中                                               |
| 表格行（默认档）纵向 padding   | 8px（行高≈41）                                            | **10px（行高≈45）**                                              | 47（4.2）→41 过密；45 为折中，small/large 档继续走 EP 原生                                         |
| 表格正文字号                   | 13px（`--font-size-sm`）                                  | **14px（`--font-size-base`）**                                   | 与 EP `--el-font-size-base` 一致，回归「表即正文」的层级                                           |
| 表头 `TABLE_HEADER_CELL_STYLE` | 底 `--fill-subtle`（#fafafa）+ 字 `--fg-muted` + 12px/600 | **底 `--fill-muted`（#f5f7fa）+ 字 `--fg`（#303133）+ 12px/600** | 恢复 4.2 灰底深字结构线；12px/600 维持「小而实」的精致口径（4.2 为 14px/600，字号保留 5.0 的收敛） |
| 工具栏高                       | 54px                                                      | 维持                                                             | 与 28px 热区匹配良好                                                                               |

### 1.3 导航与强调（恢复锚点）

| 令牌/规则                                              | 现值                        | 推荐值                                                                       | 理由                                                   |
| ------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| 菜单激活底 `--pure-theme-menu-active-bg`（浅色皮肤）   | `hsl(var(--primary) / 15%)` | **`hsl(var(--primary))` 实心**（`data-nav-style="plain"` 偏好档继续用 tint） | 恢复全站唯一高饱和锚点；#006BE6 底 + 白字 = 4.9:1 达标 |
| 菜单激活字 `--pure-theme-menu-active-text`（浅色皮肤） | `hsl(var(--primary))`       | **`#fff`**（实心块内）                                                       | 同上                                                   |
| 菜单激活块圆角 `--nav-item-radius`                     | 8px                         | **6px**                                                                      | 项高 46px 下 8px 偏大；与控件 6px 同心                 |
| 暗色模式菜单激活                                       | `hsl(var(--fg) / 12%)` 底   | 维持                                                                         | 暗色下实心过重，tint 是正确口径                        |
| hover 图标缩放                                         | 仅侧栏 `scale(1.2)`         | **全站取消或统一到 1.08**                                                    | 微动效口径统一（见 1.5）                               |

### 1.4 排版阶梯（维持 + 一处回退）

| 项                | 现值                                 | 推荐值                                       |
| ----------------- | ------------------------------------ | -------------------------------------------- |
| 字号阶梯          | 11/12/13/14/16/18/20/24              | 维持                                         |
| 字重              | 400/500/600/700 令牌化               | 维持                                         |
| 页头 `.page-head` | 20px/600 + 13px 副题                 | 维持                                         |
| 表单标签          | 700                                  | 维持（4.2 同）                               |
| 行高五档          | none/tight/snug/normal/relaxed/loose | 维持；正文消费 `--line-height-normal`（1.5） |

### 1.5 动效参数（统一节拍）

| 场景               | 现值                            | 推荐值   | 理由                                                            |
| ------------------ | ------------------------------- | -------- | --------------------------------------------------------------- |
| `--duration-hover` | 0.15s                           | **0.2s** | 0.15s 偏「跳」；0.2s 与 `--duration-fast` 合并成单一 hover 节拍 |
| 页签项过渡         | `all 0.4s`（`--duration-slow`） | **0.2s** | 与菜单/按钮 hover 同拍                                          |
| 按钮               | 0.1s                            | 维持     | EP 原生口径                                                     |
| 页面切换           | 0.5s fade-transform             | 维持     | 4.2 同值                                                        |
| 菜单/弹层缓动      | EP 官方贝塞尔                   | 维持     | 像素中性                                                        |

### 1.6 暗色模式规则（不回退）

- 保留蓝灰三级表面（页底 #14161a < 卡面 #1c1e23 ≤ 顶栏/侧栏 = 卡面 < 浮层 #242424）；
- 保留卡片/弹窗 `inset 0 1px 0 hsl(var(--fg)/5%)` 顶部高光；
- 菜单激活在暗色**继续用 tint**（`hsl(var(--fg)/12%)`），不用实心块——深底上实心块过重；
- 表头在暗色自动跟随 `--fill-muted`（浅色档 #f5f7fa → 暗色档 19% 表面），无需特判。

## 二、组件规格（状态矩阵）

### 按钮

| 状态      | 规格                                                                                       |
| --------- | ------------------------------------------------------------------------------------------ |
| 默认      | 主色实底 + 白字 + 6px 圆角 + 32px 高（EP 默认）；hover = `primary-light-3` 提亮（EP 原生） |
| plain     | 浅主色底 + `primary-dark-2` 字（现值维持，AA 达标）                                        |
| 行内 link | 主色文字，hover 仅提亮不加底                                                               |
| disabled  | `--fg-disabled` 字 + 无底（现值维持）                                                      |

### 输入框 / 选择器

- 6px 圆角、1px `--border` 描边、32px 高（default 档）；
- focus：主色描边 + `--ring` 焦点环（现值维持）。

### 卡片（层次四态）

| 形态                                                   | 描边                     | 圆角 | 阴影                                             |
| ------------------------------------------------------ | ------------------------ | ---- | ------------------------------------------------ |
| 内容卡（列表页工作纸 `.re-plus-table-card`、表单容器） | `--border-light` #e4e7ed | 8px  | `--shadow-card`（双层贴地）                      |
| 展示卡（看板/工作台 `.app-card`）                      | 同上                     | 8px  | 静止贴地，hover `--shadow-lg` + translateY(-2px) |
| 浮层（dialog/drawer/dropdown）                         | 无描边                   | 6px  | `--shadow-lg` / `--shadow-float`                 |
| 面板（侧栏面板 `.app-pane`）                           | `--border-light`         | 8px  | `--shadow-card`                                  |

### 表格（默认档状态）

| 部位     | 规格                                                               |
| -------- | ------------------------------------------------------------------ |
| 表头     | `--fill-muted` 底 + `--fg` 字 + 12px/600 + 单行省略；下缘 hairline |
| 表体     | 14px、行高 ≈45（padding 10px 0）、居中对齐、`tabular-nums`         |
| 行 hover | `--fill-muted` 底（EP 原生）                                       |
| 行分隔   | `--divider`（前景 6%）                                             |
| 已读行   | `--fg-subtle` 整行降级（现值维持）                                 |
| 空态     | ReEmpty + `--el-text-color-regular`（现值维持）                    |

### 弹窗 / 抽屉

- 6px 圆角、`--shadow-lg`、标题 18px/内容 14px（EP 原生）；
- 页脚吸边：`--shadow-footer-edge`（1px 描边 + 微投影，现值维持）；
- 关闭钮 24px 热区、4px 圆角 hover 底（现值维持）。

### 页签条

- 默认（chrome 风格）恢复**浏览器页签形**：激活项 `--fill-muted` 底 + 主色字 +
  上缘 2px 主色条或梯形；圆角块（现形态）保留为偏好档；
- 项高 38px 维持；hover 0.2s。

### 菜单（侧栏）

| 状态         | 规格                                                          |
| ------------ | ------------------------------------------------------------- |
| 默认         | 46px 项高、图标 18px、文字 14px、缩进 16px 步进               |
| hover        | `--pure-theme-menu-hover` 底 + 图标缩放 ≤1.08（或取消）+ 0.2s |
| 激活（浅色） | 实心主色块（inset 8px、margin 2px 0、radius 6px）+ 白字       |
| 激活（暗色） | `hsl(var(--fg)/12%)` 底 + `--fg` 字                           |

## 三、常见错误清单（do / don't）

**don't**

1. don't 用 <8% 明度差或 <15% 透明度的 tint 作为**唯一**激活/选中标识（4.2→5.0 的教训）；
2. don't 表头用「最浅底 + muted 字 + 缩字号」三连（层次坍塌三件套）；
3. don't 改全局 `line-height`/根字号去迁就单行控件（用组件局部变量；根字号动了 Tailwind `--spacing` 全站连坐）;
4. don't 控件与容器用同值圆角（外 8 内 6，嵌套差 2px 同心）;
5. don't 卡片描边取 `--border-lighter` 以下档位（白底不可读）；
6. don't 三种 hover 时长并存（0.1/0.15/0.4）——全站 hover 一个节拍 0.2s；
7. don't 阴影只写单层 0 偏移（读不出层次）；浮层用 `--shadow-lg` 起。

**do**

1. do 每屏保留至少一个高饱和锚点（激活菜单块 / 主按钮 / 页签激活条）；
2. do 灰底结构线（表头/分组头）用 `--fill-muted` 底 + `--fg` 字的强对比组合；
3. do 数字列 `tabular-nums`、表头单行省略、长文本省略加 tooltip；
4. do 焦点可见（`:focus-visible` + `--ring`）；
5. do 暗色用「表面色差 + 顶部高光」替代重阴影；
6. do 新组件一律消费语义令牌（既有门禁：color/font-size/spacing/size literals）；
7. do 动效优先动 transform/opacity，配 `prefers-reduced-motion` 降级。

## 四、分阶段落地计划

### 阶段 1：令牌级（1~2 人日，低风险，全站受益）

改动面：

| 文件                                       | 改动                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `src/style/reset.scss`                     | html 行高 1.15 → 1.5                                                                |
| `src/style/tokens/primitives.scss`         | `--nav-item-height` 42→46、`--nav-item-radius` 8→6、`--duration-hover` 0.15→0.2     |
| `src/style/tokens/semantic.scss`           | `--shadow-card` 双层化；浅色皮肤 `--pure-theme-menu-active-bg/-text` 实心主色+白字  |
| `src/style/tokens/ep-bridge.scss`          | `--el-border-radius-base: var(--radius-lg)` → `var(--radius-md)`（4→6px，开放项 B） |
| `src/utils/tableHeader.ts`                 | 表头底/字色对调为 `--fill-muted` + `--fg`                                           |
| `src/style/element-plus.scss`              | `.el-table--default` 行 padding 8→10、字号 13→14                                    |
| `src/style/semantic`（`--card-border`）    | 描边档位 lighter→light                                                              |
| `src/layout/components/lay-tag/index.scss` | 页签过渡 0.4→0.2s                                                                   |

测试同步：`src/style/__tests__/`（tokenBridge / epColorLadder / sidebarLayoutParity）
断言更新；视觉基线重录约 10 张（`node scripts/e2e-run.mjs visual:update` 受影响 spec）。

回归风险：**低**——全部是「改值不改机制」，E2E 断言多不依赖具体像素；
视觉基线差异是预期产物。验收：`pnpm test:run && pnpm lint`，
`node scripts/e2e-run.mjs smoke:fresh`，人工走查 3 个代表页（列表/表单/看板）。

### 阶段 2：组件级（2~3 人日，中风险）

1. 页签条恢复浏览器页签形（chrome 风格），现圆角块降级为「朴素」偏好档；
2. 微动效口径统一：hover 图标缩放取消或全站 1.08、所有 hover 0.2s；
3. `RePureTableBar` 标题字重与页头去重逻辑复查（页头开启时隐藏工具栏标题——已实现，验证覆盖面）；
4. 空态/加载态骨架规格对齐（ReEmpty + 骨架屏圆角 6px）。

改动面：`lay-tag`、`sidebar/_common.scss`、`RePureTableBar/src/bar.tsx`、
相关偏好档注册（`platform-config.json` 若新增偏好键需走 §四 成组登记流程）。
回归风险：**中**——涉及交互偏好，需双浏览器 `smoke:fresh` + 视觉基线。

### 阶段 3：页面级（按页灰度，每页 0.5~1 人日，高风险）

看板/工作台卡片网格、系统设置两面板、聊天/AI 页面的行高与卡片节奏逐页校准；
每页人工验收 + 视觉基线。建议顺序：使用频率最高的列表页 → 看板 → 设置页。

## 五、验收口径

1. 每阶段结束跑全量前端门禁（`pnpm test:run`、`pnpm lint`、`node scripts/check-file-length.mjs`）；
2. 视觉基线按阶段重录并人工确认 diff 图（先判断布局差异，再重录）；
3. 双浏览器 `node scripts/e2e-run.mjs fresh` 在阶段 2 后至少跑一轮；
4. 人工走查清单：白屏页（空数据）、长文本单元格、密集表格（30+ 行）、
   暗色模式三表面、菜单激活/折叠/弹层，对照本规范「组件规格」表逐项勾验。

---

## 六、实施记录（边做边落盘）

> 2026-11-04 开工。**环境说明**：本轮为离线推进——容器环境（OrbStack）由用户处理，
> E2E 与改后截图**待环境恢复后补跑**（改前截图已留存 6 张 desktop：
> `screenshots/before/`）。验证面 = vitest / typecheck / lint / check:\* / 构建。

### 阶段 1 · 令牌级（已完成 11:17，7 文件）

| #   | 改动                  | 文件                                       | 旧值 → 新值                                                                                                             |
| --- | --------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | 全局正文行高回 1.5    | `src/style/reset.scss`                     | `line-height: 1.15 → 1.5`                                                                                               |
| 2   | hover 节拍统一        | `src/style/tokens/primitives.scss`         | `--duration-hover: 0.15s → 0.2s`                                                                                        |
| 3   | 菜单项高回呼吸档      | 同上                                       | `--nav-item-height: 42px → 46px`                                                                                        |
| 4   | 激活块圆角与控件同心  | 同上                                       | `--nav-item-radius: 8px → 6px`                                                                                          |
| 5   | 卡片描边加深一档      | `src/style/tokens/semantic.scss`           | `--card-border: --border-lighter(#ebeef5) → --border-light(#e4e7ed)`                                                    |
| 6   | 贴地阴影双层化        | 同上                                       | `--shadow-card: 0 1px 2px 6% → 0 1px 2px 7% + 0 2px 8px 5%`                                                             |
| 7   | 菜单激活回实心块      | 同上（light/default 皮肤）                 | `--pure-theme-menu-active-bg: primary/15% → primary 实心`、`-text: primary → #fff`（对比 4.15:1 → 4.9:1 达 AA）         |
| 8   | plain 偏好档保留 tint | 同上（新增块）                             | `html[data-nav-style="plain"][data-theme="light"/"default"]` 回 15% tint + 主色字                                       |
| 9   | EP 控件圆角同心       | `src/style/tokens/ep-bridge.scss`          | `--el-border-radius-base: --radius-lg(8px) → --radius-md(6px)`（容器仍 8px，外大内小）                                  |
| 10  | 表头回灰底深字        | `src/utils/tableHeader.ts`                 | 底 `--fill-subtle → --fill-muted`、字 `--fg-muted → --fg`、字号 `12px → 14px`（600 不变）——5 个表格组件单一来源同步生效 |
| 11  | 表格密度回呼吸档      | `src/style/element-plus.scss`              | `.el-table--default` 字号 `13 → 14px`、cell 纵距 `8 → 10px`（行高 ≈41 → ≈45）                                           |
| 12  | 页签项过渡归位        | `src/layout/components/lay-tag/index.scss` | `transition: --duration-slow(0.4s) → --duration-fast(0.2s)`                                                             |

阶段 1 验证：stylelint 全绿；`src/style` 令牌单测 27/27 通过
（tokenBridge / epColorLadder / sidebarLayoutParity / darkEditorTheme / animateSubset）。
暗色模式检查：`--shadow-card` 暗色块（rgb(0 0 0/40%)）维持原值、深色皮肤激活 tint 不受影响
（实心块仅作用于浅色皮肤 light/default；dark 下沿用 `hsl(var(--fg)/12%)` 提亮块）。

### 阶段 2 · 组件级（已完成 11:19，3 文件）

| #   | 改动                        | 文件                                                     | 说明                                                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **chrome 页签形恢复**       | `src/layout/components/lay-tag/index.scss`               | 删除「页签形状整体隐藏」的全局 `display:none`（2 条）；`.chrome-item` 负边距咬合 `calc(-1*(16+2)px)=-18px`、去圆角块；`.chrome-item.is-active` 专享覆写——撤通用圆角块、形状填 `primary-light-9`（暗色 dark.scss 原有 `primary-light-8` 覆写自动生效）、`z-index:10` 盖过咬合邻居、0 0 1px 描边阴影；非激活 hover 走形状填色 `--fill-strong`（4.2 的 #dee1e6 同位），不再用圆角底块 |
| 2   | 图标微放大统一 1.08         | `src/style/sidebar/_common.scss`、`_sidebar-narrow.scss` | 菜单 hover 图标 `scale(1.2) → 1.08`（主列与双列窄列同口径；1.2 过猛）                                                                                                                                                                                                                                                                                                              |
| 3   | 顶栏/工具栏动作同口径       | `src/style/tailwind.css`                                 | `navbar-action` / `table-bar-action` 两个 @utility 补 `svg` hover `scale(1.08)` + transform 过渡（0.2s）——全站导航入口微动效单一口径                                                                                                                                                                                                                                               |
| 4   | 圆角同心（容器 8 / 控件 6） | `src/style/tokens/ep-bridge.scss`                        | 已在阶段 1 落地（`--el-border-radius-base → --radius-md`）；容器侧 appearance.scss `--el-card-border-radius: --radius-lg(8px)` 不变，外大内小                                                                                                                                                                                                                                      |

阶段 2 验证：stylelint 全绿、prettier 全绿、令牌单测 27/27。
工具栏标题去重（页头开启时隐藏工具栏内同名标题）为既有实现，源码核对无回归。

### 阶段 3 · 页面级 + 动画专项（已完成 11:25，1 文件改动 + 令牌自动生效面）

| #   | 改动               | 文件                                        | 说明                                                               |
| --- | ------------------ | ------------------------------------------- | ------------------------------------------------------------------ |
| 1   | 工具栏标题字重统一 | `src/components/RePureTableBar/src/bar.tsx` | `font-bold(700) → font-semibold(600)`，与 `.page-head__title` 同级 |

令牌驱动自动生效面（核对过消费点，无内联残留）：

- **列表页/看板/设置页/详情抽屉/弹窗**：卡片描边与阴影（`--card-border`/`--shadow-card`）、
  控件圆角 6px（`--el-border-radius-base`）、表格表头与密度（`TABLE_HEADER_CELL_STYLE` 单一来源，
  RePlusPage / DataTable / ReReadonlyTable / AiResultTable / ReMessageNotifications 五组件同步）、
  正文行高 1.5、hover 节拍 0.2s、图标微放大 1.08——均随令牌全站生效；
- **长文本/空数据**：表头单行省略与 `tabular-nums` 为既有实现（保留）；空态（ReEmpty）
  走 EP 令牌 + 对比度收口，无需改；
- **密集表格**：small/large 密度档继续走 EP 原生（`.el-table--small/--large`），默认档为本次回呼吸档；
- **暗色模式**：`--shadow-card` 暗色值维持（0 1px 2px rgb(0 0 0/40%)）、菜单激活暗色 tint
  （`hsl(var(--fg)/12%)`）、页签形状暗色填 `primary-light-8`（dark.scss 既有覆写自动生效）、
  卡片顶部内高光维持——暗色零回退。

动画专项清单（全部落地）：

1. 单一 hover 节拍 0.2s（`--duration-hover` + 页签项过渡收敛）；按钮维持 EP 原生 0.1s；
2. 图标 hover 微放大统一 `scale(1.08)`：侧栏主列 / 双列窄列 / 顶栏动作 / 表格工具栏（此前 1.2 只在侧栏）；
3. EP 组件过渡时长/缓动由 ep-bridge 统一接令牌（0.3s base + 官方贝塞尔）；
4. 搜索区展开/收起高度过渡（useSearchCardCollapse，260ms + clip-path 揭开）为既有实现，保留；
5. `prefers-reduced-motion` 全局降级（transition.scss 通配 0.01ms + 卡片/pressable 专项）为既有实现，保留；
6. 无新增无意义动效——本次只收敛节拍与幅度，未加新动画。

### 全量离线验证（2026-11-04 11:26 汇总）

| 验证项                     | 结果                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vitest 全量                | **558 文件 / 3392 用例全绿**                                                                                                                                                |
| typecheck（tsc + vue-tsc） | 通过                                                                                                                                                                        |
| eslint `--max-warnings 0`  | 通过（改动面 = 11 个 src 文件）                                                                                                                                             |
| prettier / stylelint       | 通过                                                                                                                                                                        |
| check:\* 门禁 31 项        | **31/31 通过**（`e2e-waits` 需为临时截图 spec 登记 1 处时间域例外——ECharts canvas 动画稳定窗，与 visual.e2e.ts stabilize 同口径，见 `e2e/wait-for-timeout-allowlist.json`） |
| 行数门禁                   | 通过（存量基线 0 增长）                                                                                                                                                     |
| 生产构建 `pnpm build`      | 通过（dist/version = 5.0.2）；`check:bundle-size` 在预算内通过（代码账本 +15KB 顶到预算线，为 HEAD 既有提交的增量，非本次样式改动）                                         |

### 待环境恢复后补跑（占位，勿当完成）

> **2026-11-04 13:10 更新：本节四项已全部完成**，实测结果如下（保留原文占位供追溯）。

### 环境恢复后的补跑结果（2026-11-04，全部完成）

| 项                | 结果与证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **改后截图**      | 16 张全落盘（4 页 × 明暗 × 桌面/移动）：`screenshots/after/`。截图 spec 三处修正后一次通过：① login 页须匿名 context（已登录访问 /#/login 被守卫重定向）；② 移动端**必须带 iPhone 13 UA**（`deviceDetection()` 是 UA 判定而非宽度判定，纯 390 视口仍渲染 desktop 布局）；③ 主题切换借 desktop 上下文落库、移动端用原生视口（resize 会让侧栏残留 desktop 展开态）。**目检四项风险全过**：行高 1.5 对搜索区占位无挤压、46px 菜单项协调、表格行距 45px 呼吸感良好、暗色表头灰带与卡片边界均可读；「一张工作纸」结构确认；welcome 第 4 张卡为点阵**实时时钟**（既有组件、秒级动态、历来靠 2% 容差吸收），非缺陷。移动端表格横向滚动为容器内既有形态（mobile.e2e 页面级无溢出断言通过佐证） |
| **E2E**           | chromium：smoke 9/9 + 定向 36/36（auth / login-policy / system-pages / mobile / theme-dark）；webkit：定向 32/32（4 skipped = mobile.e2e 的 chromium-only 用例，按设计跳过）。本机 webkit 需显式 `PLAYWRIGHT_BROWSERS_PATH`（沙箱 HOME 缓存缺 webkit 二进制）                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **darwin 基线**   | 比对 16 过 / 10 失败 → **10 张 diff 逐张定性**：9 张为整改预期变化（菜单实心块 + 46px 步进、表头灰底深字 14px、行距 45、行高 1.5、圆角 6/8、卡片描边/阴影；对应 welcome / system-user / analysis-dashboard / system-role / demo-book × chromium+webkit）；1 张 `analysis-screen-webkit` 为**渲染时序/抗锯齿噪声**（描边型 1-2px、结构零位移、chromium 同页通过，本次未动大屏）→ 既有 webkit 噪声面。**零真回归** → `visual:update` 重录 10 张 → 复跑 26/26 全绿                                                                                                                                                                                                                        |
| **linux 基线**    | `docker run --rm` playwright 镜像重录（`e2e/README.md` 已固化完整跑法与坑位）：chromium-linux 更新 7 张（login/system-menu 因 linux 字体渲染差异略超 2% 容差，同属预期变化）+ **webkit-linux 13 张全新补齐（历史从未录过）** → 复跑 26/26 全绿。配套基建：`playwright.config.ts` 新增 `E2E_HOST`、`stub_llm.py` 新增 `STUB_LLM_HOST`（默认值均不变，宿主行为零影响）                                                                                                                                                                                                                                                                                                                   |
| **临时截图 spec** | `e2e/design-screenshots.e2e.ts` **保留**（不再按原计划移入回收站）：四轮打磨后已稳定可复用（改前/改后对照截图的常设工具），`waitForTimeout` 时间域例外已登记 `wait-for-timeout-allowlist.json`；后续 UI 改动 `E2E_DESIGN_SHOT=1` 即可复跑                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### 第二轮：视觉基线确定性根因治理（2026-11-06，轮次验证完成）

上轮遗留的四条「剩余风险」全部按根因治理（**不放宽容差、不删用例**）。环境恢复后实测又暴露
三个深层根因（时钟冻结与 EP/zrender 的相互作用、菜单 rank 并列），一并治掉：

| 治理项                                                          | 手段（治根因）                                                                                                                                                                                                                                                                                                                                                                                                       | 状态                                                             |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| welcome 点阵实时时钟卡（靠容差吸收秒跳）                        | `setFixedTime(E2E_CLOCK_FROZEN_AT)` 固定 Date——**只在 stabilize 内、全部交互之后调用**。实测教训两条：① `install()+pauseAt()` 会连 rAF 一起暂停，DOM 静默窗永久挂起（login 连续 2.0m 超时）；② 冻结的 Date 会让 Element Plus el-menu 目录点击展开失效（A/B 实测：无 clock / install 可展开，setFixedTime 下事件到达、Vue handler 在位但状态不迁移）——登录/菜单导航必须在冻结前完成                                   | 完成，时钟区域固定为 08:00:00                                    |
| ECharts canvas 时序噪声（2.5s 盲等）                            | 三层治理：① `chartTheme.ts` 的 `animation:false` 总闸在**模块加载时**读一次偏好——`test.use({ reducedMotion: "reduce" })` 加载即注入（stabilize 内补注入等于总闸从未激活）；② zrender 动画时间轴读 `new Date().getTime()`（zrender/lib/animation/Animation.js），冻结后 enter 动画永停第 0 帧（实测大屏三张图表全部空数据）——加载即关动画后首帧即终帧，与冻结时钟解耦；③ stabilize 以 MutationObserver 静默窗替代盲等 | 完成；旧 `waitForTimeout(2500)` 与 e2e-waits 登记已注销（48→46） |
| 图表/时钟 canvas 重绘静默窗探不到（数据装载只发生在 canvas 上） | **canvas 指纹稳定窗**：对页面全部 canvas 取 toDataURL 滚动哈希，连续两轮 600ms 采样不变才放行（图表落定 + 时钟收敛为冻结时刻的联合信号；实测修复前大屏截图拿到「只有坐标轴」的空数据中间态）                                                                                                                                                                                                                         | 完成                                                             |
| 菜单 rank 并列导致侧栏顺序跨会话漂移                            | 种子数据 `system` 与 `DemoBook` 同为 rank=1，`order_by("rank")` 单键排序下并列行顺序由执行计划决定——侧栏顶级菜单顺序漂移、整页基线随侧栏位移抖动（diff 分析：全侧栏 208px 宽区域红移、行签名互相关出现 ±48px 一项位移峰）。修复：菜单排序统一 `order_by("rank", "pk")`（routes 视图 ×2 / 菜单管理 / 菜单搜索 / 权限树序列化器共 5 处）+ 反序创建守护用例（`test_routes_view.py::TestRankTieOrderDeterministic`）     | 完成，18/18 通过                                                 |
| webkit 大屏描边噪声                                             | 同上：reducedMotion 加载注入 + 冻结时钟 + canvas 指纹窗覆盖「时钟 tick + 入场动画中间帧」两个噪声源                                                                                                                                                                                                                                                                                                                  | 完成（见下方轮次数据）                                           |
| linux login / system-menu 容差边缘                              | 定性结论（e2e/README 已登记）：chromium headless 默认 `--font-render-hinting=none`（非 hinting 所致）；边缘 = linux 字体栅格化 + 描边/圆角微调的叠加，**无需改渲染开关**                                                                                                                                                                                                                                             | 定性完成，linux 轮次见下                                         |

基线重录（darwin）：9 张实际变更——时钟页 6 张（welcome ×2 / 大屏深浅 ×4，冻结时刻 08:00:00，
`--update-snapshots` 只重写失败项，时钟页需临时收紧容差强制固化）+ reducedMotion 加载注入带来的
**确定性**渲染位移 3 张（`system-role-webkit` 侧栏滚动锚点、`system-user-add-dialog-invalid` ×2
弹窗高 845→848px；repeat-each×3 实测恒定）；排序修复后再补录 webkit `system-user`/`system-role`
两张（11-04 基线恰好录到 DemoBook-first 顺序）。

同轮交付：**移动端顶栏收敛**（390/360 档实测挤压）：`applyMobileNavbarLayout`（search/notice 保留、
refresh/lock 等动作类并入既有「更多」下拉、弹层类 language/fullscreen 不渲染、用户名文字不渲染；
纯响应式降级，偏好存储与桌面编排不受影响）+ 4 条单测（catalog.spec 12/12）；
**产品口径建议清单** `ui-product-decisions.md`（媒体可见性 BE-L3 / 图标候选面 curated / 浅主色对比度）。

离线全量复验（2026-11-04，以最终代码）：vitest **558 文件 / 3396 用例全绿**（+4 新增守护用例）、
typecheck、eslint `--max-warnings 0`、prettier、stylelint、**check:\* 31/31**、行数门禁、
build + bundle-size 全部通过。

环境恢复后的轮次验证（2026-11-06，OrbStack 恢复方式：正确 `HOME` 下 `orb start`——沙箱把 HOME
改到 TwinSpace 目录导致 orb CLI 用错 socket 路径，此前三次超时均为该环境问题）：

- [x] darwin 连续 3 轮比对全绿：**26/26 × 3 轮**（2.5m / 2.4m / 2.8m；期间治理两个新根因——
      菜单 rank 并列排序、侧栏滚动落点漂移，治理后复跑三轮全绿）+ welcome 单用例连续
      **5/5 通过**（chromium，容差不放大，51.3s）
- [x] linux（docker 容器）基线重录 + 连续 3 轮全绿：重录 8 张（system-user/menu/role ×2 浏览器
      = 排序与滚动归一变化）+ 时钟页 6 张强制固化；**26/26 × 3 轮**（2.3m / 2.1m / 2.1m）+
      welcome 5/5（23.7s）
- [x] mobile.e2e 回归 **5/5**、a11y.e2e 回归 **26/26**；design-screenshots 移动端重拍通过
      （修复会话复用已登录证据的移动端回归：`#header-translation` 语言图标被收敛后快路径误判，
      改用 `#main-content` 布局级锚点）
- [x] 360px 档顶栏目检：search / 通知 / 「更多」/ 设置 / 头像间距正常，无拥挤溢出
      （一次性证据，不入基线）
