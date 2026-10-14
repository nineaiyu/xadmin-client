# 组件库总览（`src/components`）

本目录是 xadmin 的组件体系：布局/表格容器由 `RePlusPage` 生态承担，通用能力以 `Re*` 前缀沉淀，
AI 与聊天域组件（`Ai* / Chat* / Message*`）为两处业务线共用的展示与交互层。

> 维护约定：新组件按 `src/components/<Name>/`（实现 `src/index.vue|.tsx`、类型 `src/types.ts`、
> barrel `index.ts`（`withInstall`）、单测 `__tests__/*.spec.ts`）落位；纯逻辑抽纯函数单独可测；
> 消费端一律从 barrel import（`@/components/<Name>`），不直接指向 `src/.../index.vue`。
> 门禁：`pnpm test:run`（组件级单测）+ `pnpm check:module-cycles` + `pnpm check:bundle-size`。

## 一、按用途分组

| 分组                             | 组件                                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面与容器                       | `RePlusPage`（元数据驱动列表页）、`RePlusSearch`（实体搜索下拉）、`RePage`（通用内容骨架）、`ReSplitPane`、`ReReadonlyTable`、`RePureTableBar`、`ReRecycleBin`（RePlusPage 内建） |
| 状态与反馈                       | `ReStateContainer`（loading/empty/error/ready 四态）、`ReResult`（结果态）、`ReEmpty`、`ReSkeleton`、`ReSegmented`                                                                |
| 数据展示                         | `ReCountTo`、`ReText`（省略 + tippy）、`ReJsonViewer`、`ReTableAction`（操作列）、`ReActionPanel`、`RePermissionPreview`                                                          |
| 表单与输入                       | `SearchPicker`、`ReApiSelect` / `ReApiTreeSelect`、`ReSliderCaptcha`、`ReImageVerify`、`ReSendVerifyCode`、`RePictureUpload`、`ReCropper`、`ReMfaConfirm`                         |
| 弹层                             | `ReDialog`、`ReDrawer`、`ReNavDrawer`                                                                                                                                             |
| 布局与图标                       | `ReIcon`（离线图标 + `useRenderIcon`）、`ReCol`、`ReAuth`、`ReResize`（拖拽缩放盒）                                                                                               |
| AI 域（聊天室与 AI 控制台共用）  | `AiThinking`、`AiMessageBlock`、`AiStreamingBubble`、`AiActionCard`、`AiResultTable`、`ApiScopeEditor`                                                                            |
| 聊天域（聊天室与 AI 控制台共用） | `ChatMessageList`、`ChatTextBubble`、`ChatSystemNotice`、`ChatMessageAvatar`、`MessageTimeDivider`、`NewMessagesBadge`、`MessageThreadPanel`、`MessageActionAttachments`          |

> **弹窗表单标签宽度**：`RePlusPage` 的新增/编辑弹窗（`AddOrEdit`）标签宽度按当前页签
> 最长标签自适应（`src/components/RePlusPage/src/utils/adaptiveLabelWidth.ts`）：列元数据
> 离屏估算出首帧宽度，挂载后按真实标签内容（文本 + 冒号 + 帮助图标）克隆实测校正，
> 上限 300px、窄视口按 40% 视口宽收敛。多页签表单各页签独立取宽，避免一个页签的长标签
> 压窄另一个页签；标签占宽导致半宽列（`colProps` 的 `md/lg/xl: 12`，如售价
> `el-input-number`、上传区）控件列不足 160px 时，该列自动升为整行。
> 长标签与带帮助文本图标的标签不再折成两行，守护见 `e2e/form-label-width.e2e.ts`。

## 二、AI / 聊天域组件

两条消息线（聊天室 `views/chat`、AI 控制台 `views/integration/ai`）共用同一套展示组件，
差异只经 props / slots 注入（testid 前缀、名字行、空态口径等），组件不感知具体数据源。

```vue
<!-- AI 流式回答（聊天室与助手页同一形态） -->
<AiStreamingBubble
  testid="ai-streaming"
  stop-testid="ai-stream-stop"
  stop-label="停止生成"
  :reasoning="streamReasoning"
  :content="streamContent"
  @stop="abortStream"
/>

<!-- 消息内嵌动作：草稿确认卡 + 只读结果表（可执行性由父级注入） -->
<MessageActionAttachments
  :extra="message.extra"
  :runnable="canRunActions"
  :executor="executeAction"
  testid-prefix="chat"
  disabled-hint="没有执行权限"
/>

<!-- 消息流面板骨架：行组件与输入区经插槽注入 -->
<MessageThreadPanel
  title="AI 助手"
  title-testid="ai-panel-title"
  :is-narrow="isNarrow"
  list-testid="ai-messages"
  :skeleton-visible="firstLoading"
  :history-bar-visible="hasHistory"
  :has-more="hasMore"
  :loading-more="loadingMore"
  :empty-visible="emptyVisible"
  :pending-count="pendingCount"
  @load-more="loadMore"
  @jump-to-latest="scrollToLatest"
>
  <template #composer><ChatComposer /></template>
</MessageThreadPanel>

<!-- 只读动作结果表：columns/rows、series、results、键值对象四形态自动成表 -->
<AiResultTable :data="actionResult" />
```

要点：

- `AiThinking`：流式自动展开并内部滚动跟随，结束后收起为「已思考 · N 字」摘要，点击可回看；
- `AiMessageBlock`：思考面板 + 正文（流式光标 / 空态三点）+ 出处；有思考时不重复渲染等待动画；
- `AiActionCard`：受限动作一律「用户二次确认」后执行；`pending`（审批拦截）转「重试」；
- `ChatMessageList`：滚动容器 + 历史骨架 + 加载更早 + 空态；滚动元素经 `ready` 回传给父级；
- 类型：每个组件目录的 `types.ts` 是 props 的单一来源，barrel 再导出（`export * from "./types"`）。

## 三、通用组件

| 组件                              | 用法示例                                                                     | 说明                                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RePage`                          | `<RePage title="详情" :auto-content-height="true">…</RePage>`                | 非列表页的统一骨架（页头/内容区/页脚），`title` / `description` / `extra` 插槽；窄屏页头自动堆叠                                                                                    |
| `ReStateContainer`                | `<ReStateContainer :state="state" :error-text="err">…</ReStateContainer>`    | 四态收敛；loading 默认骨架（`skeleton`/`spinner` 两档），加载态带 `aria-busy` 与 `role="status"`；`minLoadingTime`（默认 50ms）窗口内就绪不闪现 loading 占位                        |
| `ReResult`                        | `<ReResult status="403" title="无权限" />`                                   | 居中式结果态（success/info/warning/error/403/404/500/coming-soon/offline）                                                                                                          |
| `ReTableAction`                   | `<ReTableAction :actions="actions" :dropdown-actions="more" :auth="auth" />` | 操作列契约：`popConfirm` / `danger` / `ifShow`，图标按钮自动补可访问名                                                                                                              |
| `ReJsonViewer`                    | `<ReJsonViewer :value="payload" :expand-depth="2" copyable />`               | 基于 `vue-json-pretty` 懒加载；配置预览 / 动作入参出参 / 审计详情                                                                                                                   |
| `ReResize`                        | `<ReResize :w="320" :h="180" :is-resizable="true">…</ReResize>`              | 绝对定位拖拽缩放盒（拖动 + 八向手柄 + 父容器约束；`snap` 吸附钩子、props↔box 同步、`scale` 反换算 + 手柄屏幕尺寸恒定）；大屏自由画布（ADR-086/088）为其业务落点，栅格语义画布不适用 |
| `ReApiSelect` / `ReApiTreeSelect` | `<ReApiSelect :api="roleApi" label-field="name" />`                          | 通用远程下拉（与 `SearchPicker` 的实体会话搜索不同）；共用 `useApiOptions`（缓存 / 重取 / 归一）                                                                                    |
| `ReSliderCaptcha`                 | `<ReSliderCaptcha v-model="passed" @success="onPass" />`                     | 拖到末端通过；键盘可达（方向键步进、`Home`/`End` 直达），触屏 Pointer 事件统一                                                                                                      |

## 四、增强组件

> **以下组件已全部接入真实页面**：`ReScrollbar` → AI 控制台左栏 `AiFeatureNav`（功能导航滚动区，经 `label` 下发可访问名）；`ReCollapseParams` → 监控「告警阈值设置」弹窗 `ThresholdForm`（名称列支持可选 `label`）；`ReRenderContent` → `AiResultTable` 单元格；`ReIconPicker` → 菜单管理 `MenuFormBasic` 与代码生成 `BaseConfig` 的图标字段；`ReBackTop` → 布局内容区（`lay-content` 与 `layout/index.vue` 两分支）；旋转 / 拼图验证码 → 邀请激活页 `accept.vue`（拼图，题图 `assets/captcha/puzzle.svg`）。下方表格的「接入条件」为原始交付口径，保留备查。

| 组件                       | 用法示例                                                                       | 说明                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReScrollbar`              | `<ReScrollbar :height="360" shadow @scroll-at="onArrival">…</ReScrollbar>`     | 增强滚动条（底层 `el-scrollbar`）：派发四向到达态 `scroll-at`，未到边界一侧显示渐变遮罩；暴露 `scrollTo` / `setScrollTop` / `updateArrival`；滚动容器带 `role="region"` + `tabindex="0"`（方向键 / `PageUp` / `PageDown` 可键盘滚动），可访问名经 `label` 传入。接入条件 = 需要「滚动到底加载更多 / 新内容提示」或遮罩提示的列表（通知中心、聊天、抽屉） |
| `ReCollapseParams`         | `<ReCollapseParams :params="schema" v-model:value="vals" visible-count="3" />` | 参数折叠面板：三列（名称 / 值 / 说明）+ 前 N 行可见、其余折叠；控件走 `el-input` / `el-input-number` / `el-select`；展开按钮带 `aria-expanded` / `aria-controls`（关联折叠区），窄屏自动改纵向堆叠；暴露 `toggleCollapsed` / `resetValues` / `updateValues`。接入条件 = 需要编辑一组带说明与取值范围的参数（工具入参、算法/规则参数）                    |
| `ReRenderContent`          | `<ReRenderContent :content="value" />`                                         | 内容渲染器：字符串 / 数字按文本、组件 / VNode 交给 `h()`；`renderBr` 按换行拆段（不解析 HTML）。接入条件 = 列值 / 消息体「可能是字符串或组件」的统一渲染                                                                                                                                                                                                 |
| `ReIconPicker`             | `<ReIconPicker v-model="icon" />`                                              | 图标选择器：**薄封装** `ReIcon` 的离线选择器（搜索 + 图标集页签 + 网格分页），不重复实现                                                                                                                                                                                                                                                                 |
| `ReBackTop`                | `<ReBackTop :visibility-height="300" right="24" bottom="24" />`                | 回到顶部：**自实现**（原生 `button`：可聚焦、`Enter` / `Space` 原生触发；不封装 `el-backtop`——其多根渲染导致 `role` / `tabindex` / `aria-label` 无法透传、键盘不可达），默认目标 = 布局内容区滚动容器（`LAYOUT_SCROLL_SELECTOR`）                                                                                                                        |
| `ReSliderRotateCaptcha`    | `<ReSliderRotateCaptcha :src="img" v-model="passed" />`                        | 旋转验证码：拖动滑条把随机倾斜的图片转正（复用 `ReSliderCaptcha`，`isSlot` 关闭自动通过、按角度容差判定）；几何纯函数在 `src/geometry.ts`                                                                                                                                                                                                                |
| `ReSliderTranslateCaptcha` | `<ReSliderTranslateCaptcha :src="img" v-model="passed" />`                     | 拼图验证码：拖动滑条使拼图块对齐缺口（复用 `ReSliderCaptcha` + `actionOffset` 行程换算）；几何纯函数在 `src/geometry.ts`                                                                                                                                                                                                                                 |

## 五、单测与文档维护

- 组件级单测与实现同目录（`__tests__/`），纯逻辑单独成测试文件；
- 新增组件请同步本文件分组表，并在实现文件头部写清「何时用 / 何时不用」；
- 依赖使用情况见 `docs/component-dependencies.md`（依赖 → 消费组件映射，用于后续裁剪与升级评估）。
