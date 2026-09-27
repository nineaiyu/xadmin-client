import type { FormFieldType } from "@/api/dataset/dform";

/** 控件类型清单与标签词条（字段表设计器与版本预览共用，避免两处漂移） */
export const FIELD_TYPE_OPTIONS: { value: FormFieldType; labelKey: string }[] =
  [
    { value: "input", labelKey: "dform.typeInput" },
    { value: "textarea", labelKey: "dform.typeTextarea" },
    { value: "number", labelKey: "dform.typeNumber" },
    { value: "amount", labelKey: "dform.typeAmount" },
    { value: "select", labelKey: "dform.typeSelect" },
    { value: "radio", labelKey: "dform.typeRadio" },
    { value: "checkbox", labelKey: "dform.typeCheckbox" },
    { value: "date", labelKey: "dform.typeDate" },
    { value: "switch", labelKey: "dform.typeSwitch" },
    { value: "upload", labelKey: "dform.typeUpload" },
    { value: "daterange", labelKey: "dform.typeDaterange" },
    { value: "table", labelKey: "dform.typeTable" },
    { value: "user", labelKey: "dform.typeUser" },
    { value: "cascader", labelKey: "dform.typeCascader" }
  ];

/** 控件类型标签词条（未知类型回退单行文本词条） */
export const fieldTypeLabelKey = (type: string): string =>
  FIELD_TYPE_OPTIONS.find(item => item.value === type)?.labelKey ??
  "dform.typeInput";
