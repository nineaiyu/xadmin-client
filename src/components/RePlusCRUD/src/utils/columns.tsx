import { computed, h, ref } from "vue";
import { cloneDeep } from "lodash-es";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import type { PlusColumn } from "plus-pro-components";
import type { BaseApi } from "@/api/base";
import type { SearchColumnsResult, SearchFieldsResult } from "@/api/types";
import { get } from "lodash-es";
import { renderSegmentedOption, formatAddOrEditOptions } from "./renders";
import { selectBooleanOptions } from "./constants";
import {
  getPickerShortcuts,
  getColourTypeByIndex,
  formatPublicLabels
} from "./index";

import SearchDepts from "@/views/system/base/searchDepts.vue";
import SearchRoles from "@/views/system/base/searchRoles.vue";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import uploadFile from "../components/uploadFile.vue";
import { ElIcon, ElImage, ElLink } from "element-plus";
import { Link } from "@element-plus/icons-vue";
import Info from "@iconify-icons/ri/question-line";

/**
 * @description 定义自定义搜索模板
 */
const apiSearchComponents = {
  "api-search-depts": SearchDepts,
  "api-search-roles": SearchRoles,
  "api-search-users": SearchUsers
};
/**
 * @description 用与通过api接口，获取对应的column, 进行前端渲染
 */
export function useBaseColumns(localeName: string) {
  const addOrEditRules = ref({});
  const addOrEditColumns = ref([]);
  const addOrEditDefaultValue = ref({});
  const searchColumns = ref([]);
  const searchDefaultValue = ref({});
  const listColumns = ref([]);
  const showColumns = ref([]);
  const { t, te } = useI18n();

  const formatSearchColumns = (columns: SearchFieldsResult["data"]) => {
    columns.forEach(column => {
      const item: PlusColumn = {
        label:
          formatPublicLabels(t, te, column.key, localeName) ?? column.label,
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
          item.colProps = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
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
          item.options = computed(() => {
            const options = formatAddOrEditOptions(column.choices);
            options?.forEach(option => {
              const labels = option.label.split(" ");
              option.label = `${formatPublicLabels(t, te, labels[0] as string, localeName)} ${formatPublicLabels(t, te, labels[1] as string, localeName)}`;
            });
            return options;
          });
          break;
        default:
          if (column.input_type.startsWith("api-")) {
            item.renderField = (value, onChange) => {
              return h(apiSearchComponents[column.input_type], {
                modelValue: value,
                onChange
              });
            };
            item.colProps = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
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
          message:
            formatPublicLabels(t, te, column.key, localeName) ?? column.label,
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
        label:
          formatPublicLabels(t, te, column.key, localeName) ?? column.label,
        tooltip: column?.help_text,
        minWidth: 120,
        fieldProps: {
          maxlength: column?.max_length,
          showWordLimit: true,
          multiple: column?.multiple
        },
        hideInSearch: true,
        hideInTable: false,
        // pure-table ****** start
        cellRenderer: ({ row }) => (
          <span v-copy={row[column.key]}>{row[column.key]}</span>
        )
        // pure-table ****** end
      };
      // pure-table ****** start
      if (column?.help_text) {
        item["headerRenderer"] = () => (
          <span class="flex-c">
            {item.label}
            <iconifyIconOffline
              icon={Info}
              class={["ml-1"]}
              v-tippy={{
                content: column?.help_text
              }}
            />
          </span>
        );
      }
      // pure-table ****** end
      switch (column.input_type) {
        case "integer":
        case "float":
          item["valueType"] = "input-number";
          item["fieldProps"]["controlsPosition"] = "right";
          // item["fieldProps"]["controls"] = false;
          // pure-table ******
          // delete item["cellRenderer"];
          break;
        case "string":
        case "field":
          item["valueType"] = "input";
          break;
        case "datetime":
        case "date":
          item["valueType"] = "date-picker";
          item["fieldProps"]["type"] = column.input_type;
          item["fieldProps"]["valueFormat"] = "YYYY-MM-DD HH:mm:ss";
          item["width"] = 160;
          // pure-table ****** start
          item["cellRenderer"] = ({ row }) => (
            <span v-copy={row[column.key]}>
              {dayjs(row[column.key]).format("YYYY-MM-DD HH:mm:ss")}
            </span>
          );
          // pure-table ****** end
          break;
        case "boolean":
          item["valueType"] = "radio";
          item["renderField"] = renderSegmentedOption();
          item["width"] = 120;
          item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
          break;
        case "textarea":
          item["valueType"] = "textarea";
          item["fieldProps"] = { autosize: { minRows: 8 } };
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
      if (column.key === "description") {
        item.valueType = "textarea";
        item["fieldProps"] = { autosize: { minRows: 3 } };
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
            // pure-table ****** start
            item["cellRenderer"] = ({ row }) => (
              <span v-copy={get(row, `${column.key}.label`)}>
                {get(row, `${column.key}.label`)}
              </span>
            );
            // pure-table ****** end
            break;
          case "object_related_field":
            item["prop"] = `${column.key}.pk`;
            item["options"] = computed(() =>
              formatAddOrEditOptions(column?.choices)
            );
            // pure-table ****** start
            item["cellRenderer"] = ({ row }) => (
              <span v-copy={get(row, `${column.key}.label`)}>
                {get(row, `${column.key}.label`)}
              </span>
            );
            // pure-table ****** end
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
            // pure-table ****** start
            item["cellRenderer"] = ({ row }) => (
              <>
                <el-space>
                  {row[column.key]?.map((item, index) => {
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
            // pure-table ****** end
            break;
          case "image upload":
            item["valueType"] = "img";
            // pure-table ****** start
            item["cellRenderer"] = ({ row }) =>
              h(ElImage, {
                lazy: true,
                src: row[column.key],
                alt: row[column.key],
                previewSrcList: [row[column.key]],
                previewTeleported: true
              });
            // pure-table ****** end
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
            // pure-table ****** start
            item["cellRenderer"] = ({ row }) =>
              h(
                ElLink,
                {
                  type: "success",
                  href: row[column.key],
                  target: "_blank"
                },
                {
                  icon: () => h(ElIcon, null, () => h(Link)),
                  default: () => "文件连接"
                }
              );
            // pure-table ****** end
            break;
          case "boolean":
            item["options"] = computed(() => selectBooleanOptions);
            item["valueType"] = "switch";
            delete item["renderField"];
            // item["editable"] = true;
            break;
        }
        showColumns.value.push(cloneDeep(item));
        if (column.table_show) {
          listColumns.value.push(cloneDeep(item));
        }
      }
    });
  };

  /**
   * 该方法用于页面onMount内调用，用于第一次渲染页面
   */
  const getColumnData = (
    api: BaseApi,
    columnsCallback = null,
    fieldsCallback = null
  ) => {
    api.columns().then(res => {
      formatAddOrEditColumns(res.data);
      columnsCallback && columnsCallback();
    });
    api.fields().then(res => {
      formatSearchColumns(res.data);
      fieldsCallback && fieldsCallback();
    });
  };

  return {
    listColumns,
    showColumns,
    searchColumns,
    getColumnData,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  };
}
