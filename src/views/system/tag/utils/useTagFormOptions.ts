import { shallowRef } from "vue";
import { CHART_ACCENT, epColor } from "@/utils/chartTheme";
import type { RePlusPageProps } from "@/components/RePlusPage";

/**
 * 标签新增/编辑表单的元数据微调。
 *
 * `color` 由框架 `color` 渲染器提供 `el-color-picker`（默认色板是固定的
 * 9 色硬编码）；这里替换为项目语义色板：EP 语义色经 CSS 变量取值（跟随自定义
 * 主题色与暗色主题）+ 图表强调色，与旧手写表单的预设一致。后端只接受
 * `#rrggbb`（`COLOR_PATTERN`），故关闭 alpha 通道。
 */
export function useTagFormOptions() {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        color: ({ column }) => {
          column.fieldProps = {
            ...column.fieldProps,
            showAlpha: false,
            predefine: [
              epColor("primary"),
              epColor("success"),
              epColor("warning"),
              epColor("danger"),
              epColor("info"),
              CHART_ACCENT
            ]
          };
          return column;
        }
      }
    }
  });

  return { addOrEditOptions };
}
