import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import { createLevelRow } from "./types";
import { buildRuleFormColumns } from "./ruleFormColumns";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 审批规则新建/编辑表单（元数据驱动，混合形态）：
 * - `name` / `priority` / `is_active` / `remark` 直接用后端字段；
 * - `path_patterns` / `methods` / `levels` 三条列定制见 ruleFormColumns.ts；
 * - 展平后的规则文本（路径/方法/级次）与原手写表单完全一致，仅承载方式改为字段渲染器。
 */
export function useRuleFormOptions({ t }: { t: TFunction }) {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        // 新建态给一级空级次（与原手写表单一致：打开即可填审批人）
        levels: ({ rawRow }: { rawRow?: RecordType }) => {
          const levels = rawRow?.levels;
          return Array.isArray(levels) && levels.length
            ? levels
            : [createLevelRow()];
        }
      },
      columns: buildRuleFormColumns({ t }),
      formProps: {
        rules: {
          // 路径必选：勾选目录与自定义正则合并后为空即拦截（与原手写表单提示一致）
          path_patterns: [
            {
              validator: (
                _rule: unknown,
                value: unknown,
                callback: (error?: Error) => void
              ) => {
                if (Array.isArray(value) && value.length > 0) callback();
                else callback(new Error(t("approvalRule.pathsRequired")));
              },
              trigger: "change"
            }
          ]
        }
      }
    }
  });

  return { addOrEditOptions };
}
