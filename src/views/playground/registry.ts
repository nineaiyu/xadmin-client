/**
 * 组件 Playground 注册表（src/components/README.md 分组表的可执行镜像）。
 *
 * 收敛 43 个 Re* 自研组件的名称 / 分组 / 用途一句话 / 样例页归属；
 * 与 README 分组表同源维护——README 标注「可执行文档见 /playground」，
 * vitest 守护两边名字集合一致（见 __tests__/registry.spec.ts）。
 */
export type PlaygroundCategory =
  "display" | "layout" | "input" | "feedback" | "ecosystem";

export interface PlaygroundEntry {
  /** 组件目录名（src/components/<name>） */
  name: string;
  category: PlaygroundCategory;
  /** 一句话用途（与 README 分组表同源） */
  description: string;
  /** 有活样例的组件：指向 demo 路由 */
  demo?: "/playground/display" | "/playground/layout" | "/playground/input";
}

export const CATEGORY_LABELS: Record<PlaygroundCategory, string> = {
  display: "playground.catDisplay",
  layout: "playground.catLayout",
  input: "playground.catInput",
  feedback: "playground.catFeedback",
  ecosystem: "playground.catEcosystem"
};

export const PLAYGROUND_ENTRIES: PlaygroundEntry[] = [
  // ---- 展示（display）----
  {
    name: "ReText",
    category: "display",
    description: "省略文本 + tippy 提示（可展开）",
    demo: "/playground/display"
  },
  {
    name: "ReEmpty",
    category: "display",
    description: "空态（可配次级提示 / 图标 / 尺寸档）",
    demo: "/playground/display"
  },
  {
    name: "ReResult",
    category: "display",
    description: "通用结果态（info/success/warning/danger/offline）",
    demo: "/playground/display"
  },
  {
    name: "ReStat",
    category: "display",
    description: "统计条 StatBar / 统计网格 StatGrid",
    demo: "/playground/display"
  },
  {
    name: "ReCountTo",
    category: "display",
    description: "数字滚动动画（普通 + 回弹两形态）",
    demo: "/playground/display"
  },
  {
    name: "ReJsonViewer",
    category: "display",
    description: "JSON 树查看（懒加载 vue-json-pretty）",
    demo: "/playground/display"
  },
  {
    name: "ReSkeleton",
    category: "display",
    description: "骨架屏（text / fill 两变体）",
    demo: "/playground/display"
  },
  {
    name: "ReScrollbar",
    category: "display",
    description: "增强滚动条（到达态事件 + 遮罩）",
    demo: "/playground/display"
  },
  // ---- 布局（layout）----
  {
    name: "ReCol",
    category: "layout",
    description: "栅格列（pureadmin 上游件）",
    demo: "/playground/layout"
  },
  {
    name: "ReSplitPane",
    category: "layout",
    description: "可拖拽分栏容器",
    demo: "/playground/layout"
  },
  {
    name: "ReResize",
    category: "layout",
    description: "拖拽缩放盒（八向手柄）",
    demo: "/playground/layout"
  },
  {
    name: "ReCollapseParams",
    category: "layout",
    description: "参数折叠面板（名称/值/说明三列）",
    demo: "/playground/layout"
  },
  {
    name: "RePage",
    category: "layout",
    description: "通用页面骨架（页头 + 内容 + 页脚）"
  },
  { name: "ReNavDrawer", category: "layout", description: "导航抽屉" },
  // ---- 输入（input）----
  {
    name: "ReIconPicker",
    category: "input",
    description: "图标选择器（薄封装 ReIcon）",
    demo: "/playground/input"
  },
  {
    name: "ReAnimateSelector",
    category: "input",
    description: "animate.css 动画选择器",
    demo: "/playground/input"
  },
  {
    name: "ReImageVerify",
    category: "input",
    description: "图形验证码（canvas 自包含）",
    demo: "/playground/input"
  },
  {
    name: "ReSliderCaptcha",
    category: "input",
    description: "滑块验证码（键盘 + 触屏可达）",
    demo: "/playground/input"
  },
  {
    name: "ReSendVerifyCode",
    category: "input",
    description: "验证码发送（倒计时按钮，需后端配置接口）"
  },
  { name: "ReCropper", category: "input", description: "图片裁剪" },
  {
    name: "RePictureUpload",
    category: "input",
    description: "图片裁剪预览上传"
  },
  {
    name: "ReApiSelect",
    category: "input",
    description: "远程取数下拉 / 树选（含 ReApiTreeSelect）"
  },
  { name: "RePlusSearch", category: "input", description: "实体搜索下拉" },
  // ---- 反馈（feedback）----
  {
    name: "ReDialog",
    category: "feedback",
    description: "统一弹窗出口（组件注册 + 命令式 API）"
  },
  {
    name: "ReDrawer",
    category: "feedback",
    description: "统一抽屉出口（组件注册 + 命令式 API）"
  },
  {
    name: "ReStateContainer",
    category: "feedback",
    description: "loading/empty/error/ready 四态收敛"
  },
  {
    name: "ReMfaConfirm",
    category: "feedback",
    description: "命令式唤起身份二次验证对话框"
  },
  { name: "ReNoticeShow", category: "feedback", description: "通知展示" },
  {
    name: "ReMessageNotifications",
    category: "feedback",
    description: "消息通知"
  },
  {
    name: "ReTaskCenterDrawer",
    category: "feedback",
    description: "任务中心抽屉"
  },
  {
    name: "ReTaskLogDialog",
    category: "feedback",
    description: "任务日志弹窗"
  },
  {
    name: "ReBackTop",
    category: "feedback",
    description: "回到顶部（自实现原生 button）"
  },
  // ---- 容器与生态（ecosystem）----
  {
    name: "RePlusPage",
    category: "ecosystem",
    description: "元数据驱动列表页生态（含 ReRecycleBin）"
  },
  {
    name: "RePureTableBar",
    category: "ecosystem",
    description: "表格工具栏（配 @pureadmin/table）"
  },
  {
    name: "ReTableAction",
    category: "ecosystem",
    description: "表格操作列（主操作 + 更多下拉）"
  },
  {
    name: "ReReadonlyTable",
    category: "ecosystem",
    description: "只读少列键值表"
  },
  {
    name: "ReRenderContent",
    category: "ecosystem",
    description: "内容渲染器（字符串/组件/VNode → VNode）"
  },
  {
    name: "ReIcon",
    category: "ecosystem",
    description: "离线图标渲染 + useRenderIcon"
  },
  {
    name: "ReMenuPermissionTree",
    category: "ecosystem",
    description: "菜单权限树"
  },
  {
    name: "RePermissionPreview",
    category: "ecosystem",
    description: "权限预览"
  },
  {
    name: "ReActionPanel",
    category: "ecosystem",
    description: "实体管理动作抽屉"
  },
  {
    name: "ReTreeLine",
    category: "ecosystem",
    description: "el-tree / el-tree-v2 连接线"
  }
];
