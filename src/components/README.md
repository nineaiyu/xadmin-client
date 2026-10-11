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

## 三、三期新增组件（对标 vben `common-ui`）

| 组件                              | 用法示例                                                                     | 说明                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `RePage`                          | `<RePage title="详情" :auto-content-height="true">…</RePage>`                | 非列表页的统一骨架（页头/内容区/页脚），`title` / `description` / `extra` 插槽；窄屏页头自动堆叠  |
| `ReStateContainer`                | `<ReStateContainer :state="state" :error-text="err">…</ReStateContainer>`    | 四态收敛；loading 默认骨架（`skeleton`/`spinner` 两档），加载态带 `aria-busy` 与 `role="status"`  |
| `ReResult`                        | `<ReResult status="403" title="无权限" />`                                   | 居中式结果态（success/info/warning/error/403/404/500/coming-soon/offline）                        |
| `ReTableAction`                   | `<ReTableAction :actions="actions" :dropdown-actions="more" :auth="auth" />` | 操作列契约对齐 vben `VbenTableAction`；`popConfirm` / `danger` / `ifShow`，图标按钮自动补可访问名 |
| `ReJsonViewer`                    | `<ReJsonViewer :value="payload" :expand-depth="2" copyable />`               | 基于 `vue-json-pretty` 懒加载；配置预览 / 动作入参出参 / 审计详情                                 |
| `ReResize`                        | `<ReResize :w="320" :h="180" :is-resizable="true">…</ReResize>`              | 绝对定位拖拽缩放盒（在库待用：大屏 / 表单设计器为栅格语义，出现自由定位编辑场景时接入）           |
| `ReApiSelect` / `ReApiTreeSelect` | `<ReApiSelect :api="roleApi" label-field="name" />`                          | 通用远程下拉（与 `SearchPicker` 的实体会话搜索不同）；共用 `useApiOptions`（缓存 / 重取 / 归一）  |
| `ReSliderCaptcha`                 | `<ReSliderCaptcha v-model="passed" @success="onPass" />`                     | 拖到末端通过；键盘可达（方向键步进、`Home`/`End` 直达），触屏 Pointer 事件统一                    |

## 四、单测与文档维护

- 组件级单测与实现同目录（`__tests__/`），纯逻辑单独成测试文件；
- 新增组件请同步本文件分组表，并在实现文件头部写清「何时用 / 何时不用」；
- 依赖使用情况见 `docs/component-dependencies.md`（依赖 → 消费组件映射，用于后续裁剪与升级评估）。
