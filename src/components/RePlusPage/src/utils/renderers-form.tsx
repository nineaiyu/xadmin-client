import { computed, defineAsyncComponent, h } from "vue";
import dayjs from "dayjs";
import {
  formatAddOrEditOptions,
  renderBooleanSegmentedOption
} from "./renders";
import type {
  PhoneInputProps,
  PlusColumnHandler,
  PlusColumnRegistry
} from "./types";
// 表单编辑器组件仅在新增/编辑弹窗出现，全部懒加载：jsoneditor/wangeditor 等
// 重依赖不进首屏主包（TD-27 主包体积专项）
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

/**
 * 表单列（新增/编辑）内置渲染器：input_type -> 对 PageColumn 就地配置
 * 迁移自 columns.tsx formatAddOrEditColumns 的第一个 switch-case
 */
export const builtinFormRenderers: PlusColumnRegistry = {
  integer: numberFormRenderer,
  float: numberFormRenderer,
  string: item => {
    item["valueType"] = "input";
  },
  field: item => {
    item["valueType"] = "input";
  },
  color: item => {
    item["valueType"] = "color-picker";
    item["fieldProps"]["showAlpha"] = true;
    item["fieldProps"]["predefine"] = [
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
    item["fieldProps"]["type"] = column.input_type;
    item["fieldProps"]["valueFormat"] = "YYYY-MM-DD HH:mm:ss";
    item["width"] = 160;
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
    item["fieldProps"]["type"] = column.input_type;
    item["fieldProps"]["valueFormat"] = "YYYY-MM-DD";
    item["width"] = 140;
    // pure-table ******
    item["cellRenderer"] = ({ row }) => (
      <span v-copy={row[column.key]}>
        {row[column.key] ? dayjs(row[column.key]).format("YYYY-MM-DD") : ""}
      </span>
    );
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
      item["fieldProps"]["multiple"] = true;
      item["fieldProps"]["filterable"] = true;
      item["options"] = computed(() =>
        formatAddOrEditOptions(childChoices, false)
      );
      return;
    }
    item["renderField"] = (value, onChange) => {
      return h(TagInput, {
        modelValue: value as Array<string>,
        onChange: x => {
          onChange(x);
        }
      });
    };
  },
  phone: (item, { column }) => {
    column.default = { name: "China", code: "+86" };
    item["renderField"] = (value, onChange) => {
      return h(PhoneInput, {
        modelValue: value as PhoneInputProps,
        onChange: x => {
          onChange(x);
        }
      });
    };
  },
  json: item => {
    item["renderField"] = (value, onChange) => {
      return h(JsonInput, {
        modelValue: value as string | Record<string, unknown>,
        onChange: x => {
          onChange(x);
        }
      });
    };
  }
};

/** 表单列回退渲染器：对应原 default 分支（api-* 自定义搜索组件） */
export const formFallbackRenderer: PlusColumnHandler = (item, ctx) => {
  const { column, apiSearchComponents } = ctx;
  if (column.input_type.startsWith("api-")) {
    if (!column.hasOwnProperty("default")) {
      column.default = column?.multiple ? [] : undefined;
    }
    item["renderField"] = (value, onChange) => {
      return h(apiSearchComponents[column.input_type], {
        modelValue: value,
        multiple: column?.multiple ?? false,
        onChange
      });
    };
  }
};

/** integer / float 共用 */
function numberFormRenderer(item, { column }) {
  item["valueType"] = "input-number";
  item["fieldProps"]["controlsPosition"] = "right";
  item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
  if (column.key === "pk") {
    item["minWidth"] = 80;
  }
}

/** choice / multiple choice 共用 */
function choiceFormRenderer(item, { column }) {
  item["valueType"] = "select";
  item["fieldProps"]["filterable"] = true;
  item["options"] = computed(() =>
    formatAddOrEditOptions(column?.choices, false)
  );
  if (column.input_type === "multiple choice") {
    item["fieldProps"]["multiple"] = true;
  }
}

/** labeled_choice / labeled_multiple_choice / object_related_field / m2m_related_field 共用 */
function labeledChoiceFormRenderer(item, { column }) {
  item["valueType"] = "select";
  item["fieldProps"]["filterable"] = true;
  item["options"] = computed(() =>
    formatAddOrEditOptions(column?.choices, true)
  );
  if (
    ["labeled_choice", "labeled_multiple_choice"].indexOf(column.input_type) ===
    -1
  ) {
    item["fieldProps"]["valueKey"] = "pk";
  }
  if (column.input_type === "labeled_multiple_choice") {
    item["fieldProps"]["multiple"] = true;
  }
}

/** *_related_field_file / *_related_field_image 共用 */
function relatedFieldFileFormRenderer(item, { column }) {
  if (column.input_type.startsWith("object_related_field_")) {
    item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
  }
  item["renderField"] = (value, onChange) => {
    return h(UploadFiles, {
      modelValue: value,
      isImageFile: column.input_type.endsWith("_related_field_image"),
      multiple: column.multiple,
      onChange: x => {
        onChange(x);
      }
    });
  };
}

/** image upload / file upload 共用 */
function uploadFormRenderer(item, { column }) {
  delete item["fieldProps"];
  item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
  item["renderField"] = (value, onChange) => {
    return h(UploadFile, {
      modelValue: value,
      isImageFile: column.input_type === "image upload",
      onChange: x => {
        onChange(x);
      }
    });
  };
}
