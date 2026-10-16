/**
 * AiThinking 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 思考过程面板：流式自动展开并滚动跟随，完成后收起为摘要行、可点击回看。
 */

export interface AiThinkingProps {
  /** 思考内容（流式追加 / 落库全文） */
  text?: string;
  /** 是否正在流式输出 */
  streaming?: boolean;
  /** 初始展开（历史消息默认折叠） */
  defaultOpen?: boolean;
}
