/** 展示入参：结构化数据或 JSON 字符串 */
export interface JsonViewerProps {
  /** 要展示的结构化数据（对象或 JSON 字符串） */
  value: unknown;
  /** 展开深度（`expanded` 为 true 时忽略） */
  expandDepth?: number;
  /** 是否可复制（每个节点显示复制按钮） */
  copyable?: boolean;
  /** 是否显示边框 */
  boxed?: boolean;
  /** 主题（`dark*` 归一到暗色主题） */
  theme?: "light" | "dark" | "default-json-theme" | "dark-json-theme";
  /** 是否全部展开 */
  expanded?: boolean;
  /** 预览模式（折叠所有节点） */
  previewMode?: boolean;
  /** 是否显示双引号 */
  showDoubleQuotes?: boolean;
}

/** 复制动作载荷 */
export interface JsonViewerAction {
  action: string;
  text: string;
  trigger: HTMLElement;
}
