/**
 * 文件上传表单规则（纯函数，自 useSystemUploadFile 抽出便于单测直测）：
 * 上传登记（is_add）与存量外链行（is_upload 为假）要求 file_url 为合法 URL，
 * 校验失败文案沿用原规则第一条的 message。非上述场景保持服务端规则原样。
 */

// 纯函数走深路径取用：桶出口会连带 PhoneInput → api/common 的组件图，
// 在「api 模块先于认证链加载」的入口序上撞认证模块环（api/auth 等 class
// 定义依赖 api/base 先完成初始化），详见 api/base 的模块环说明
import { isUrl } from "@/components/RePlusPage/src/utils";
import type { RecordType } from "plus-pro-components";

type FileUrlRules = Record<string, Array<Record<string, unknown>>>;

type RuleContext = {
  isAdd?: boolean;
  rawRow?: RecordType;
};

export function withFileUrlRequiredRule(
  rules: FileUrlRules,
  { isAdd, rawRow }: RuleContext
): FileUrlRules {
  if (isAdd || !rawRow?.is_upload) {
    const fileUrlRule = rules["file_url"][0];
    rules["file_url"] = [
      {
        required: true,
        validator: (
          _rule: unknown,
          value: string,
          callback: (error?: Error) => void
        ) => {
          if (!isUrl(value)) {
            callback(new Error(fileUrlRule?.message as string | undefined));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ];
  }
  return rules;
}
