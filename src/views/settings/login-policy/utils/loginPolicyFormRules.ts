import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 校验回调（Element Plus 规则 validator 的最小依赖面） */
type ValidateCallback = (error?: Error) => void;

/**
 * 登录访问策略的跨字段校验规则（元数据协议无 linkage / 表单级 validator，
 * 用「实时表单快照 + 当前字段值」实现两条相互关联的规则）：
 * - `start_time` / `end_time` 必须成对填写；
 * - `target_type` 非 all 时 `target_value` 必填。
 *
 * 快照由弹层 `onChange` 维护（见 useLoginPolicyFormOptions），规则闭包只读 ref，
 * 不依赖打开弹窗时的入参副本。
 */
export function buildLoginPolicyRules({
  t,
  snapshot
}: {
  t: TFunction;
  snapshot: { value: RecordType };
}) {
  const timePairRule = (field: "start_time" | "end_time") => ({
    validator: (_rule: unknown, value: unknown, callback: ValidateCallback) => {
      const next = { ...snapshot.value, [field]: value };
      if (Boolean(next.start_time) !== Boolean(next.end_time)) {
        callback(new Error(t("loginPolicy.timePairInvalid")));
        return;
      }
      callback();
    },
    trigger: "change"
  });

  const targetValueRule = {
    validator: (_rule: unknown, value: unknown, callback: ValidateCallback) => {
      const next: RecordType = { ...snapshot.value, target_value: value };
      const targetType = next.target_type as { value?: string } | string;
      const type =
        typeof targetType === "string" ? targetType : targetType?.value;
      if (type && type !== "all" && !String(next.target_value ?? "").trim()) {
        callback(new Error(t("loginPolicy.targetValueRequired")));
        return;
      }
      callback();
    },
    trigger: "change"
  };

  return {
    start_time: [timePairRule("start_time")],
    end_time: [timePairRule("end_time")],
    target_value: [targetValueRule]
  };
}
