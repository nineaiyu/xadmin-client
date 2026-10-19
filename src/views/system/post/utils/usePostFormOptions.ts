import { h, shallowRef } from "vue";
import { ElTag } from "element-plus";
import { hasAuth } from "@/router/utils";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 岗位新增/编辑表单的元数据微调：
 * - `dept`：关联字段默认选项值是整对象（配合 labeled 结构），岗位接口下发 pk，
 *   这里改为标量选项；无部门列表权限时保持空选项并禁用（与旧手写表单口径一致，
 *   留空仍可提交 = 组织通用岗）；
 * - `rank`：补排序边界（模型层无 min/max 声明，旧表单限制 1~9999）；
 * - `user_count`：元数据只读字段默认不进表单，编辑态以扩展字段只读展示成员数。
 */
export function usePostFormOptions({ t }: { t: TFunction }) {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        dept: ({ column }) => {
          column.label = t("post.dept");
          if (!hasAuth("list:SystemDept")) {
            column.options = [];
            column.fieldProps = {
              ...column.fieldProps,
              disabled: true,
              placeholder: t("post.deptNoPermission")
            };
            return column;
          }
          column.valueType = "select";
          column.options = (column._column?.choices ?? []).map(item => ({
            label: item.label,
            value: item.value
          }));
          column.fieldProps = {
            ...column.fieldProps,
            filterable: true,
            clearable: true,
            placeholder: t("post.deptPlaceholder")
          };
          return column;
        },
        rank: ({ column }) => {
          column.fieldProps = {
            ...column.fieldProps,
            min: 1,
            max: 9999,
            controlsPosition: "right"
          };
          return column;
        },
        // 成员数不在元数据表单列集合内（只读字段）：作为扩展字段注入，
        // 新建态返回 undefined 表示不参与表单
        user_count: ({ column, isAdd }) => {
          if (isAdd) return undefined;
          column.label = t("post.memberCount");
          column.valueType = "text";
          column.renderField = (value: unknown) =>
            h(ElTag, { type: "info", size: "small" }, () =>
              String((value as number | undefined) ?? 0)
            );
          return column;
        }
      }
    }
  });

  return { addOrEditOptions };
}
