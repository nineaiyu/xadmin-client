import { computed, defineAsyncComponent, h } from "vue";
import dayjs from "dayjs";
import {
  formatAddOrEditOptions,
  renderBooleanSegmentedOption
} from "./renders";
import { getApiSearchComponent } from "./apiSearch";
import type {
  PageColumn,
  PhoneInputProps,
  PlusColumnContext,
  PlusColumnHandler,
  PlusColumnRegistry
} from "./types";
// 表单编辑器组件仅在新增/编辑弹窗出现，全部懒加载：jsoneditor/wangeditor 等
// 重依赖不进首屏主包
const TagInput = defineAsyncComponent(
  () => import("../components/TagInput.vue")
);
const JsonInput = defineAsyncComponent(
  () => import("../components/JsonInput.vue")
);
const UploadFile = defineAsyncComponent(
  () => import("../components/UploadFile.vue")
);
const UploadFiles = defineAsyncComponent(
  () => import("../components/UploadFiles.vue")
);
const PhoneInput = defineAsyncComponent(
  () => import("../components/PhoneInput.vue")
);
const SuggestSelect = defineAsyncComponent(
  () => import("../components/SuggestSelect.vue")
);
const WangEditor = defineAsyncComponent(
  () => import("../components/WangEditor.vue")
);

/**
 * 表单列（新增/编辑）内置渲染器：input_type -> 对 PageColumn 就地配置
 * 迁移自 columns.tsx formatAddOrEditColumns 的第一个 switch-case
 */
export const builtinFormRenderers: PlusColumnRegistry = {
  integer: numberFormRenderer,
  float: numberFormRenderer,
  decimal: decimalFormRenderer,
  string: item => {
    item["valueType"] = "input";
  },
  url: item => {
    item["valueType"] = "input";
    item["fieldProps"]!["type"] = "url";
  },
  password: item => {
    item["valueType"] = "input";
    item["fieldProps"]!["type"] = "password";
    item["fieldProps"]!["showPassword"] = true;
  },
  rich_text: item => {
    item["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) => {
      return h(WangEditor, {
        modelValue: value as string,
        "onUpdate:modelValue": onChange,
        minHeight: 280
      });
    };
  },
  field: item => {
    item["valueType"] = "input";
  },
  color: (item, { column }) => {
    item["valueType"] = "color-picker";
    item["fieldProps"]!["showAlpha"] = true;
    // 预设色板随元数据下发（ColorField(predefine=[...])）；未声明时保留既有 9 色兜底
    item["fieldProps"]!["predefine"] = column.predefine ?? [
      "#001100",
      "#ffffff",
      "#ff4500",
      "#ff8c00",
      "#ffd700",
      "#90ee90",
      "#00ced1",
      "#1e90ff",
      "#c71585"
    ];
  },
  datetime: (item, { column }) => {
    item["valueType"] = "date-picker";
    item["fieldProps"]!["type"] = column.input_type;
    item["fieldProps"]!["valueFormat"] = "YYYY-MM-DD HH:mm:ss";
    // "YYYY-MM-DD HH:mm:ss" 19 字符 + 单元格两侧内边距实测约 156px，160 已无余量，
    // 不同字体/缩放下会被截成省略号；留出安全余量保证时间完整显示
    item["width"] = 180;
    // pure-table ******
    item["cellRenderer"] = ({ row }) => (
      <span v-copy={row[column.key]}>
        {row[column.key]
          ? dayjs(row[column.key]).format("YYYY-MM-DD HH:mm:ss")
          : ""}
      </span>
    );
  },
  date: (item, { column }) => {
    item["valueType"] = "date-picker";
    item["fieldProps"]!["type"] = column.input_type;
    item["fieldProps"]!["valueFormat"] = "YYYY-MM-DD";
    item["width"] = 140;
    // pure-table ******
    item["cellRenderer"] = ({ row }) => (
      <span v-copy={row[column.key]}>
        {row[column.key] ? dayjs(row[column.key]).format("YYYY-MM-DD") : ""}
      </span>
    );
  },
  // DRF TimeField（如登录策略 start_time/end_time）：提交格式与后端同口径 HH:mm:ss
  time: item => {
    item["valueType"] = "time-picker";
    item["fieldProps"]!["format"] = "HH:mm:ss";
    item["fieldProps"]!["valueFormat"] = "HH:mm:ss";
    item["width"] = 120;
  },
  boolean: item => {
    item["valueType"] = "radio";
    item["renderField"] = renderBooleanSegmentedOption();
    item["width"] = 120;
    item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
  },
  textarea: item => {
    item["valueType"] = "textarea";
    item["fieldProps"] = { autosize: { minRows: 8 } };
  },
  choice: choiceFormRenderer,
  "multiple choice": choiceFormRenderer,
  labeled_choice: labeledChoiceFormRenderer,
  labeled_multiple_choice: labeledChoiceFormRenderer,
  object_related_field: labeledChoiceFormRenderer,
  m2m_related_field: labeledChoiceFormRenderer,
  m2m_related_field_file: relatedFieldFileFormRenderer,
  m2m_related_field_image: relatedFieldFileFormRenderer,
  object_related_field_file: relatedFieldFileFormRenderer,
  object_related_field_image: relatedFieldFileFormRenderer,
  "image upload": uploadFormRenderer,
  "file upload": uploadFormRenderer,
  list: (item, { column }) => {
    item["valueType"] = "select";
    // ListField(child=ChoiceField) 会下发候选值（child.choices），渲染多选下拉；
    // 无候选值的自由列表保持 TagInput 手动输入
    const childChoices = column?.child?.choices;
    if (childChoices?.length) {
      item["fieldProps"]!["multiple"] = true;
      item["fieldProps"]!["filterable"] = true;
      item["options"] = computed(() =>
        formatAddOrEditOptions(childChoices ?? [], false)
      );
      return;
    }
    item["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) => {
      return h(TagInput, {
        modelValue: value as Array<string>,
        onChange: (x: unknown) => {
          onChange(x);
        }
      });
    };
  },
  phone: item => {
    // 默认值不在渲染器内篡改元数据（历史缺陷：把 {name, code} 写回 column.default，
    // 国家显示名混进字段值）；空值由 PhoneInput 的模型缺省兜底
    item["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) => {
      return h(PhoneInput, {
        modelValue: value as PhoneInputProps,
        onChange: (x: unknown) => {
          onChange(x);
        }
      });
    };
  },
  json: item => {
    // 注意：renderField 在 plus-pro-components 中优先于 valueType——页面用
    // baseColumnsFormat 把 json 字段改为下拉等内置控件时，必须先清 renderField
    item["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) => {
      // 值域为任意 JSON（number/boolean/array/...），JsonInput 内部已按 unknown 接收
      return h(JsonInput, {
        modelValue: value,
        onChange: (x: unknown) => {
          onChange(x);
        }
      });
    };
  }
};

/** 表单列回退渲染器：对应原 default 分支（api-* 自定义搜索组件） */
export const formFallbackRenderer: PlusColumnHandler = (item, ctx) => {
  const { column } = ctx;
  if (column.input_type.startsWith("api-")) {
    if (!column.hasOwnProperty("default")) {
      column.default = column?.multiple ? [] : undefined;
    }
    // 元数据下发 suggest_url 时升级为远程联想（候选集与写入校验同源、
    // 权限回落资源 list 权限点）；未下发时维持 api-search-* 弹窗选择器
    if (column.suggest_url) {
      item["renderField"] = (
        value: unknown,
        onChange: (val: unknown) => void
      ) => {
        return h(SuggestSelect, {
          url: column.suggest_url as string,
          field: column.key,
          multiple: column?.multiple ?? false,
          modelValue: value,
          "onUpdate:modelValue": onChange
        });
      };
      return;
    }
    item["renderField"] = (
      value: unknown,
      onChange: (val: unknown) => void
    ) => {
      return h(getApiSearchComponent(column.input_type), {
        modelValue: value,
        multiple: column?.multiple ?? false,
        onChange
      });
    };
  }
};

/** integer / float 共用 */
function numberFormRenderer(item: PageColumn, { column }: PlusColumnContext) {
  item["valueType"] = "input-number";
  item["fieldProps"]!["controlsPosition"] = "right";
  // 数值边界与步进随元数据下发（DRF min_value/max_value 原生、step 字段显式声明），
  // 未下发时不设置，保持 el-input-number 默认行为
  if (column.min_value !== undefined)
    item["fieldProps"]!["min"] = column.min_value;
  if (column.max_value !== undefined)
    item["fieldProps"]!["max"] = column.max_value;
  if (column.step !== undefined) item["fieldProps"]!["step"] = column.step;
  item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
  if (column.key === "pk") {
    item["minWidth"] = 80;
  }
}

/** DecimalField：在数值渲染基础上按 decimal_places 推导步进与精度 */
function decimalFormRenderer(item: PageColumn, ctx: PlusColumnContext) {
  numberFormRenderer(item, ctx);
  const places = ctx.column.decimal_places;
  if (places !== undefined) {
    item["fieldProps"]!["precision"] = places;
    if (item["fieldProps"]!["step"] === undefined) {
      item["fieldProps"]!["step"] = Number(`1e-${places}`);
    }
  }
}

/** choice / multiple choice 共用 */
function choiceFormRenderer(item: PageColumn, { column }: PlusColumnContext) {
  item["valueType"] = "select";
  item["fieldProps"]!["filterable"] = true;
  item["options"] = computed(() =>
    formatAddOrEditOptions(column?.choices ?? [], false)
  );
  if (column.input_type === "multiple choice") {
    item["fieldProps"]!["multiple"] = true;
  }
}

/** labeled_choice / labeled_multiple_choice / object_related_field / m2m_related_field 共用 */
function labeledChoiceFormRenderer(
  item: PageColumn,
  { column }: PlusColumnContext
) {
  item["valueType"] = "select";
  item["fieldProps"]!["filterable"] = true;
  item["options"] = computed(() =>
    formatAddOrEditOptions(column?.choices ?? [], true)
  );
  if (
    ["labeled_choice", "labeled_multiple_choice"].indexOf(column.input_type) ===
    -1
  ) {
    item["fieldProps"]!["valueKey"] = "pk";
  }
  if (column.input_type === "labeled_multiple_choice") {
    item["fieldProps"]!["multiple"] = true;
  }
}

/** *_related_field_file / *_related_field_image 共用 */
function relatedFieldFileFormRenderer(
  item: PageColumn,
  { column }: PlusColumnContext
) {
  if (column.input_type.startsWith("object_related_field_")) {
    item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
  }
  item["renderField"] = (value: unknown, onChange: (val: unknown) => void) => {
    return h(UploadFiles, {
      modelValue: value,
      isImageFile: column.input_type.endsWith("_related_field_image"),
      multiple: column.multiple,
      onChange: (x: unknown) => {
        onChange(x);
      }
    });
  };
}

/** image upload / file upload 共用 */
function uploadFormRenderer(item: PageColumn, { column }: PlusColumnContext) {
  delete item["fieldProps"];
  item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
  item["renderField"] = (value: unknown, onChange: (val: unknown) => void) => {
    return h(UploadFile, {
      modelValue: value,
      isImageFile: column.input_type === "image upload",
      onChange: (x: unknown) => {
        onChange(x);
      }
    });
  };
}
