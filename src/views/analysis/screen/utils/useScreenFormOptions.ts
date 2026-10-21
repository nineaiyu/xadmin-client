import { h, shallowRef } from "vue";
import type { Ref } from "vue";
import { ElOption, ElSelect } from "element-plus";
import type { useI18n } from "vue-i18n";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { DashboardItem } from "@/api/dataset/datasets";
import type { RecordType } from "plus-pro-components";
import { themeColorFieldRender, themeFieldRender } from "./screenThemeForm";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 大屏新建/编辑表单（元数据驱动）：
 * - `name` / `interval` / `refresh` / `visibility` 直接用后端字段；
 * - `theme` / `theme_color` 覆写为「深浅三选一 + 主色取色」：主题是 choices，
 *   服务端回读为 `{value,label}` 对象、新建态是标量，统一按标量绑定；
 * - `dashboards` 是 JSONField（按序存仪表盘主键），换成多选下拉——选项来自
 *   页面已加载的仪表盘清单（浏览者可见域），顺序即轮播顺序；
 * - `layout` / `layout_mode` / `free_layout` 画布载荷由设计器页维护，不在本弹窗开放。
 *
 * `visibility` 是 LabeledChoiceField：接口回读是 `{value,label}` 对象，而新建态的
 * 元数据默认值是标量字符串；统一归一为对象，否则下拉匹配不到选项、显示为空。
 */
export function useScreenFormOptions({
  t,
  dashboards
}: {
  t: TFunction;
  dashboards: Ref<DashboardItem[]>;
}) {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        visibility: ({ rawRow }: { rawRow?: RecordType }) => {
          const value = rawRow?.visibility;
          return value && typeof value === "object"
            ? value
            : { value: value ?? "personal" };
        }
      },
      columns: {
        dashboards: ({ column }) => {
          delete column.valueType;
          column.renderField = (
            value: unknown,
            onChange: (value: unknown) => void
          ) =>
            h(
              ElSelect,
              {
                modelValue: (value as string[] | undefined) ?? [],
                multiple: true,
                filterable: true,
                class: "w-full",
                "onUpdate:modelValue": onChange
              },
              () =>
                dashboards.value.map(item =>
                  h(ElOption, {
                    key: item.pk,
                    label: item.name,
                    value: item.pk
                  })
                )
            );
          column.colProps = { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 };
          return column;
        },
        interval: ({ column }) => {
          column.fieldProps = { ...column.fieldProps, min: 5, max: 3600 };
          return column;
        },
        theme: ({ column }) => {
          Object.assign(column, themeFieldRender(t));
          return column;
        },
        theme_color: ({ column }) => {
          Object.assign(column, themeColorFieldRender());
          return column;
        },
        layout: ({ column }) => {
          column.hideInForm = true;
          return column;
        },
        layout_mode: ({ column }) => {
          column.hideInForm = true;
          return column;
        },
        free_layout: ({ column }) => {
          column.hideInForm = true;
          return column;
        }
      },
      formProps: {
        rules: {
          // 轮播清单至少一个：与原手写表单的提交前校验一致
          dashboards: [
            {
              required: true,
              message: t("dataScreen.required"),
              trigger: "change"
            }
          ]
        }
      }
    }
  });

  return { addOrEditOptions };
}
