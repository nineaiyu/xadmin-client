import { computed, h, ref } from "vue";
import { cloneDeep } from "lodash-es";
import type { PlusColumn } from "plus-pro-components";
import type { BaseApi } from "@/api/base";
import type { SearchColumnsResult, SearchFieldsResult } from "@/api/types";

import {
  renderSegmentedOption,
  selectBooleanOptions,
  formatAddOrEditOptions
} from "./renders";
import { getPickerShortcuts, getColourTypeByIndex } from "./index";

import SearchDepts from "@/views/system/base/searchDepts.vue";
import SearchRoles from "@/views/system/base/searchRoles.vue";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import UploadFiles from "@/views/system/base/uploadFiles.vue";
import uploadFile from "../components/uploadFile.vue";
import { ElIcon, ElLink } from "element-plus";
import { Link } from "@element-plus/icons-vue";

/**
 * @description 定义自定义搜索模板
 */
const apiSearchComponents = {
  "api-search-depts": SearchDepts,
  "api-search-roles": SearchRoles,
  "api-search-users": SearchUsers,
  "api-upload-files": UploadFiles
};
/**
 * @description 用与通过api接口，获取对应的column, 进行前端渲染
 */
export function useBaseColumns() {
  const addOrEditRules = ref({});
  const addOrEditColumns = ref([]);
  const addOrEditDefaultValue = ref({});
  const searchColumns = ref([]);
  const searchDefaultValue = ref({});
  const listColumns = ref([]);

  const formatSearchColumns = (columns: SearchFieldsResult["data"]) => {
    columns.forEach(column => {
      const item: PlusColumn = {
        label: column.label,
        prop: column.key,
        tooltip: column?.help_text,
        options: computed(() => formatAddOrEditOptions(column.choices)),
        valueType: "input",
        hideInForm: true,
        hideInTable: true
      };
      switch (column.input_type) {
        case "text":
          item.valueType = "input";
          break;
        case "datetime":
          item.valueType = "date-picker";
          item.fieldProps = {
            valueFormat: "YYYY-MM-DD HH:mm:ss"
          };
          break;
        case "datetimerange":
          item.valueType = "date-picker";
          item.fieldProps = {
            shortcuts: getPickerShortcuts(),
            valueFormat: "YYYY-MM-DD HH:mm:ss",
            type: "datetimerange"
          };
          item.colProps = {
            xs: 24,
            sm: 24,
            md: 12,
            lg: 12,
            xl: 12
          };
          break;
        case "number":
          item.valueType = "input";
          item.rules = [
            {
              validator: (rule, value, callback) => {
                if (value && !/^\d+$/.test(value)) {
                  callback(new Error("field must be a number"));
                }
              }
            }
          ];
          break;
        case "select-multiple":
          item.valueType = "select";
          item.fieldProps = {
            multiple: true
          };
          break;
        case "select-ordering":
          item.valueType = "select";
          // const options = formatAddOrEditOptions(column.choices);
          // options?.forEach(option => {
          //   const labels = option.label.split(" ");
          //   option.label = `${formatPublicLabels(t, te, labels[0] as string, localeName)} ${formatPublicLabels(t, te, labels[1] as string, localeName)}`;
          // });
          item.options = computed(() => formatAddOrEditOptions(column.choices));
          break;
        default:
          if (column.input_type.startsWith("api-")) {
            item.renderField = (value, onChange) => {
              return h(apiSearchComponents[column.input_type], {
                modelValue: value,
                onChange
              });
            };
            item.colProps = {
              xs: 24,
              sm: 24,
              md: 12,
              lg: 12,
              xl: 12
            };
          }
          item.valueType = column.input_type;
      }
      searchDefaultValue.value[column.key] = column?.default;
      searchColumns.value.push(item);
    });
  };

  const formatAddOrEditColumns = (columns: SearchColumnsResult["data"]) => {
    columns.forEach(column => {
      addOrEditRules.value[column.key] = [
        {
          required: column.required,
          message: column.label ?? column.key,
          trigger: "blur"
        }
      ];
      if (column.hasOwnProperty("default")) {
        addOrEditDefaultValue.value[column.key] = column?.default;
        if (column.input_type === "labeled_choice") {
          addOrEditDefaultValue.value[column.key] = { value: column?.default };
        }
      }

      const item: PlusColumn = {
        prop: column.key,
        label: column.label,
        tooltip: column?.help_text,
        minWidth: 120,
        fieldProps: {
          maxlength: column?.max_length,
          showWordLimit: true,
          multiple: column?.multiple
        },
        hideInSearch: true,
        hideInTable: false
      };
      switch (column.input_type) {
        case "integer":
        case "float":
          item["valueType"] = "input-number";
          item["fieldProps"]["controlsPosition"] = "right";
          // item["fieldProps"]["controls"] = false;
          break;
        case "string":
          item["valueType"] = "input";
          break;
        case "datetime":
        case "date":
          item["valueType"] = "date-picker";
          item["fieldProps"]["type"] = column.input_type;
          item["fieldProps"]["valueFormat"] = "YYYY-MM-DD HH:mm:ss";
          item["width"] = 160;
          break;
        case "boolean":
          item["valueType"] = "radio";
          item["renderField"] = renderSegmentedOption();
          item["width"] = 80;
          break;
        case "textarea":
          item["valueType"] = "textarea";
          break;
        case "labeled_choice":
        case "object_related_field":
        case "m2m_related_field":
          item["valueType"] = "select";
          item["options"] = computed(() =>
            formatAddOrEditOptions(column?.choices, true)
          );
          if (column.input_type !== "labeled_choice") {
            item["fieldProps"]["valueKey"] = "pk";
          }
          break;
        case "image upload":
        case "file upload":
          delete item["fieldProps"];
          item["renderField"] = (value, onChange) => {
            return h(uploadFile, {
              modelValue: value,
              isFile: column.input_type === "file upload",
              onChange: x => {
                onChange(x);
              }
            });
          };
          break;
        default:
          if (column.input_type.startsWith("api-")) {
            item["renderField"] = (value, onChange) => {
              return h(apiSearchComponents[column.input_type], {
                modelValue: value,
                multiple: column?.multiple ?? false,
                onChange
              });
            };
          }
      }
      if (!column.read_only) {
        addOrEditColumns.value.push(cloneDeep(item));
      }
      if (!column.write_only) {
        switch (column.input_type) {
          case "labeled_choice":
            item["prop"] = `${column.key}.value`;
            item["options"] = computed(() =>
              formatAddOrEditOptions(column?.choices)
            );
            break;
          case "object_related_field":
            item["prop"] = `${column.key}.pk`;
            item["options"] = computed(() =>
              formatAddOrEditOptions(column?.choices)
            );
            break;
          case "m2m_related_field":
            item["render"] = (value: Array<any>) => {
              if (value instanceof Array) {
                return (
                  <>
                    <el-space>
                      {value?.map((item, index) => {
                        return (
                          <el-text
                            key={item.pk}
                            type={getColourTypeByIndex(index + 1)}
                          >
                            {item.label}
                          </el-text>
                        );
                      })}
                    </el-space>
                  </>
                );
              } else return <></>;
            };
            break;
          case "image upload":
            item["valueType"] = "img";
            break;
          case "file upload":
            // item["valueType"] = "copy";
            item["render"] = (value: string) => {
              return h(
                ElLink,
                {
                  type: "success",
                  href: value,
                  target: "_blank"
                },
                {
                  icon: () => h(ElIcon, null, () => h(Link)),
                  default: () => "文件连接"
                }
              );
            };
            break;
          case "boolean":
            item["options"] = computed(() => selectBooleanOptions);
            item["valueType"] = "switch";
            delete item["renderField"];
            item["editable"] = true;
            break;
        }
        listColumns.value.push(cloneDeep(item));
      }
    });
  };

  /**
   * 该方法用于页面onMount内调用，用于第一次渲染页面
   */
  const getColumnData = (api: BaseApi, callback = null) => {
    api.columns().then(res => {
      formatAddOrEditColumns(res.data);
    });
    api.fields().then(res => {
      formatSearchColumns(res.data);
      callback && callback();
    });
  };

  return {
    listColumns,
    searchColumns,
    getColumnData,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  };
}
