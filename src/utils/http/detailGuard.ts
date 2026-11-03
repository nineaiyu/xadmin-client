/**
 * 全局错误 detail 的展示防线（纵深防御）。
 *
 * 正常时 detail 是后端按请求语言翻译的业务文案，直弹没有问题；风险在后端
 * 一旦把堆栈/内部路径/实现细节放进 detail，会原样直达终端用户。所有
 * 「全局 toast 直弹 detail」的落点在展示前统一过本防线：
 *
 * - 脱敏：命中堆栈帧/内部文件行号类特征的正则替换为占位（保守清单，宁漏勿错伤
 *   正常文案）；新增特征往 DETAIL_REDACTIONS 追加即可，无需改调用点；
 * - 截断：超过约 200 字符以省略号收尾，防整屏淹没；
 * - 排查通道：内容被改动时把未处理原文 console.warn 一份，用户侧与后端日志
 *   可对照（未改动时不打日志，避免正常业务报错刷控制台）。
 */

/** toast 展示的最大长度（约 200 字符口径） */
const DETAIL_MAX_LENGTH = 200;
const DETAIL_TRUNCATION_SUFFIX = "…";

/** 堆栈/内部实现痕迹的保守脱敏清单：只收明确无业务价值的形态 */
const DETAIL_REDACTIONS: Array<[RegExp, string]> = [
  // Python 栈帧：File "/app/x/views.py", line 123, in handler
  [/File "[^"]+", line \d+(?:, in [^\s]+)?/g, "[内部栈帧]"],
  // JS/浏览器栈帧：at foo (http://host/chunk.js:1:234) / at /app/dist/x.js:1:234
  [/\bat [\w$.<>[\]]+\s+\([^)]*:\d+:\d+\)/g, "[内部栈帧]"],
  [/\bat [^\s(]+:\d+:\d+/g, "[内部栈帧]"]
];

/** detail 展示收敛：脱敏 + 截断；原文在内容被改动时保留到控制台 */
export function sanitizeDetail(detail: string): string {
  let sanitized = detail;
  for (const [pattern, replacement] of DETAIL_REDACTIONS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  if (sanitized.length > DETAIL_MAX_LENGTH) {
    sanitized = `${sanitized.slice(0, DETAIL_MAX_LENGTH)}${DETAIL_TRUNCATION_SUFFIX}`;
  }
  if (sanitized !== detail) {
    console.warn("[xadmin] 错误 detail 已收敛展示，未处理原文如下：", detail);
  }
  return sanitized;
}
