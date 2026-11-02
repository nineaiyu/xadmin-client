import { computed, h } from "vue";
import { formatAddOrEditOptions } from "./renders";
import { getApiSearchComponent } from "./apiSearch";
import { formatPublicLabels, getPickerShortcuts } from "./index";
import type {
  PageColumn,
  PlusColumnHandler,
  PlusColumnRegistry
} from "./types";

/**
 * 搜索列内置渲染器：input_type -> 对 PageColumn 就地配置
 * 迁移自 columns.tsx formatSearchColumns 的 switch-case
 */
export const builtinSearchRenderers: PlusColumnRegistry = {
  text: item => {
    item.valueType = "input";
  },
  datetime: item => {
    item.valueType = "date-picker";
    item.fieldProps = {
      valueFormat: "YYYY-MM-DD HH:mm:ss"
    };
  },
  datetimerange: item => {
    item.valueType = "date-picker";
    item.fieldProps = {
      shortcuts: getPickerShortcuts(),
      valueFormat: "YYYY-MM-DD HH:mm:ss",
      type: "datetimerange"
    };
    item.colProps = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
  },
  number: item => {
    item.valueType = "input";
    item.fieldProps = {
      type: "number"
    };
  },
  select: (item, { column }) => {
    item.valueType = column.input_type as PageColumn["valueType"];
    item.fieldProps = {
      teleported: false,
      filterable: true
    };
  },
  "select-multiple": item => {
    item.valueType = "select";
    item.fieldProps = {
      multiple: true,
      teleported: false,
      filterable: true
    };
  },
  "select-ordering": (item, { column, t, te, localeName }) => {
    item.valueType = "select";
    item.fieldProps = {
      teleported: false,
      filterable: true
    };
    item.options = computed(() => {
      const options = formatAddOrEditOptions(column.choices ?? []);
      options?.forEach(option => {
        // 后端 label = "<verbose_name> ascending|descending"；verbose_name 可能含空格，
        // 只能从末尾匹配方向词，不能按空格切分（多词字段会把方向词拆坏）
        const text = String(option.label ?? "");
        const matched = text.match(/^(.*?)\s+(ascending|descending)$/i);
        if (!matched) {
          option.label = formatPublicLabels(t, te, text, localeName) ?? text;
          return;
        }
        const fieldLabel = matched[1].trim();
        const direction = matched[2].toLowerCase();
        option.label = `${formatPublicLabels(t, te, fieldLabel, localeName) ?? fieldLabel} ${formatPublicLabels(t, te, direction, localeName) ?? direction}`;
      });
      return options;
    });
  }
};

/** 搜索列回退渲染器：对应原 default 分支（含 api-* 自定义搜索组件） */
export const searchFallbackRenderer: PlusColumnHandler = (item, ctx) => {
  const { column } = ctx;
  if (column.input_type.startsWith("api-")) {
    item.renderField = (value, onChange) => {
      return h(getApiSearchComponent(column.input_type), {
        modelValue: value,
        onChange
      });
    };
    item.colProps = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
    // 搜索的时候，如果是api接口返回，则默认值为[]
    if (column?.default === "") {
      column.default = [];
    }
  }
  item.valueType = column.input_type as PageColumn["valueType"];
};
