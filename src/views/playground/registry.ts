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
    description: "playground.desc.ReText",
    demo: "/playground/display"
  },
  {
    name: "ReEmpty",
    category: "display",
    description: "playground.desc.ReEmpty",
    demo: "/playground/display"
  },
  {
    name: "ReResult",
    category: "display",
    description: "playground.desc.ReResult",
    demo: "/playground/display"
  },
  {
    name: "ReStat",
    category: "display",
    description: "playground.desc.ReStat",
    demo: "/playground/display"
  },
  {
    name: "ReCountTo",
    category: "display",
    description: "playground.desc.ReCountTo",
    demo: "/playground/display"
  },
  {
    name: "ReJsonViewer",
    category: "display",
    description: "playground.desc.ReJsonViewer",
    demo: "/playground/display"
  },
  {
    name: "ReSkeleton",
    category: "display",
    description: "playground.desc.ReSkeleton",
    demo: "/playground/display"
  },
  {
    name: "ReScrollbar",
    category: "display",
    description: "playground.desc.ReScrollbar",
    demo: "/playground/display"
  },
  // ---- 布局（layout）----
  {
    name: "ReCol",
    category: "layout",
    description: "playground.desc.ReCol",
    demo: "/playground/layout"
  },
  {
    name: "ReSplitPane",
    category: "layout",
    description: "playground.desc.ReSplitPane",
    demo: "/playground/layout"
  },
  {
    name: "ReResize",
    category: "layout",
    description: "playground.desc.ReResize",
    demo: "/playground/layout"
  },
  {
    name: "ReCollapseParams",
    category: "layout",
    description: "playground.desc.ReCollapseParams",
    demo: "/playground/layout"
  },
  {
    name: "RePage",
    category: "layout",
    description: "playground.desc.RePage"
  },
  {
    name: "ReNavDrawer",
    category: "layout",
    description: "playground.desc.ReNavDrawer"
  },
  // ---- 输入（input）----
  {
    name: "ReIconPicker",
    category: "input",
    description: "playground.desc.ReIconPicker",
    demo: "/playground/input"
  },
  {
    name: "ReAnimateSelector",
    category: "input",
    description: "playground.desc.ReAnimateSelector",
    demo: "/playground/input"
  },
  {
    name: "ReImageVerify",
    category: "input",
    description: "playground.desc.ReImageVerify",
    demo: "/playground/input"
  },
  {
    name: "ReSliderCaptcha",
    category: "input",
    description: "playground.desc.ReSliderCaptcha",
    demo: "/playground/input"
  },
  {
    name: "ReSendVerifyCode",
    category: "input",
    description: "playground.desc.ReSendVerifyCode"
  },
  {
    name: "ReCropper",
    category: "input",
    description: "playground.desc.ReCropper"
  },
  {
    name: "RePictureUpload",
    category: "input",
    description: "playground.desc.RePictureUpload"
  },
  {
    name: "ReApiSelect",
    category: "input",
    description: "playground.desc.ReApiSelect"
  },
  {
    name: "RePlusSearch",
    category: "input",
    description: "playground.desc.RePlusSearch"
  },
  // ---- 反馈（feedback）----
  {
    name: "ReDialog",
    category: "feedback",
    description: "playground.desc.ReDialog"
  },
  {
    name: "ReDrawer",
    category: "feedback",
    description: "playground.desc.ReDrawer"
  },
  {
    name: "ReStateContainer",
    category: "feedback",
    description: "playground.desc.ReStateContainer"
  },
  {
    name: "ReMfaConfirm",
    category: "feedback",
    description: "playground.desc.ReMfaConfirm"
  },
  {
    name: "ReNoticeShow",
    category: "feedback",
    description: "playground.desc.ReNoticeShow"
  },
  {
    name: "ReMessageNotifications",
    category: "feedback",
    description: "playground.desc.ReMessageNotifications"
  },
  {
    name: "ReTaskCenterDrawer",
    category: "feedback",
    description: "playground.desc.ReTaskCenterDrawer"
  },
  {
    name: "ReTaskLogDialog",
    category: "feedback",
    description: "playground.desc.ReTaskLogDialog"
  },
  {
    name: "ReBackTop",
    category: "feedback",
    description: "playground.desc.ReBackTop"
  },
  // ---- 容器与生态（ecosystem）----
  {
    name: "RePlusPage",
    category: "ecosystem",
    description: "playground.desc.RePlusPage"
  },
  {
    name: "RePureTableBar",
    category: "ecosystem",
    description: "playground.desc.RePureTableBar"
  },
  {
    name: "ReTableAction",
    category: "ecosystem",
    description: "playground.desc.ReTableAction"
  },
  {
    name: "ReReadonlyTable",
    category: "ecosystem",
    description: "playground.desc.ReReadonlyTable"
  },
  {
    name: "ReRenderContent",
    category: "ecosystem",
    description: "playground.desc.ReRenderContent"
  },
  {
    name: "ReIcon",
    category: "ecosystem",
    description: "playground.desc.ReIcon"
  },
  {
    name: "ReMenuPermissionTree",
    category: "ecosystem",
    description: "playground.desc.ReMenuPermissionTree"
  },
  {
    name: "RePermissionPreview",
    category: "ecosystem",
    description: "playground.desc.RePermissionPreview"
  },
  {
    name: "ReActionPanel",
    category: "ecosystem",
    description: "playground.desc.ReActionPanel"
  },
  {
    name: "ReTreeLine",
    category: "ecosystem",
    description: "playground.desc.ReTreeLine"
  }
];
