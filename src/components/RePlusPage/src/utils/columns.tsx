import { computed, h, ref } from "vue";
import { cloneDeep } from "lodash-es";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import type { BaseApi } from "@/api/base";
import type { SearchColumnsResult, SearchFieldsResult } from "@/api/types";
import { get } from "lodash-es";
import {
  formatAddOrEditOptions,
  renderBooleanSegmentedOption
} from "./renders";
import { selectBooleanOptions } from "./constants";
import type { PageColumn } from "./types";

import {
  getPickerShortcuts,
  getColourTypeByIndex,
  formatPublicLabels
} from "./index";

import { ElIcon, ElImage, ElLink } from "element-plus";
import { Link } from "@element-plus/icons-vue";
import Info from "@iconify-icons/ri/question-line";

import { isEmail, isEmpty, isNumber } from "@pureadmin/utils";

import SearchUser from "@/views/system/components/SearchUser.vue";
import SearchDept from "@/views/system/components/SearchDept.vue";
import SearchRole from "@/views/system/components/SearchRole.vue";
import TagInput from "../components/TagInput.vue";
import JsonInput from "../components/JsonInput.vue";
import UploadFile from "../components/UploadFile.vue";
import PhoneInput from "../components/PhoneInput.vue";

/**
 * @description 用与通过api接口，获取对应的column, 进行前端渲染
 */
export function useBaseColumns(localeName: string) {
  /**
   * @description 定义自定义搜索模板
   */
  const apiSearchComponents = {
    "api-search-dept": SearchDept,
    "api-search-role": SearchRole,
    "api-search-user": SearchUser
  };

  const addOrEditRules = ref({});
  const addOrEditColumns = ref([]);
  const addOrEditDefaultValue = ref({});
  const searchColumns = ref([]);
  const searchDefaultValue = ref({});
  const listColumns = ref([]);
  const detailColumns = ref([]);
  const { t, te } = useI18n();

  const formatSearchColumns = (columns: SearchFieldsResult["data"]) => {
    columns.forEach(column => {
      const item: PageColumn = {
        _column: column,
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
          item.fieldProps = {
            type: "number"
          };
          // item.rules = [
          //   {
          //     validator: (rule, value, callback) => {
          //       if (value && !/^\d+$/.test(value)) {
          //         callback(new Error("field must be a number"));
          //       } else {
          //         callback();
          //       }
          //     }
          //   }
          // ];
          break;
        case "select":
          item.valueType = column.input_type;
          item.fieldProps = {
            teleported: false
          };
          break;
        case "select-multiple":
          item.valueType = "select";
          item.fieldProps = {
            multiple: true,
            teleported: false
          };
          break;
        case "select-ordering":
          item.valueType = "select";
          item.fieldProps = {
            teleported: false
          };
          item.options = computed(() => {
            const options = formatAddOrEditOptions(column.choices);
            options?.forEach(option => {
              const labels = option.label.split(" ");
              option.label = `${formatPublicLabels(t, te, labels[0] as string, localeName) ?? labels[0]} ${formatPublicLabels(t, te, labels[1] as string, localeName) ?? labels[1]}`;
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
            // 搜索的时候，如果是api接口返回，则默认值为[]
            if (column?.default === "") {
              column.default = [];
            }
          }
          item.valueType = column.input_type;
      }
      searchDefaultValue.value[column.key] = column?.default;
      searchColumns.value.push(item);
    });
  };

  const formatAddOrEditRules = (column: SearchColumnsResult["data"][0]) => {
    const message =
      formatPublicLabels(t, te, column.key, localeName) ?? column.label;
    switch (column.input_type) {
      case "email":
        addOrEditRules.value[column.key] = [
          {
            required: column.required,
            validator: (rule, value, callback) => {
              if (value === "" || !value) {
                callback();
              } else if (!isEmail(value)) {
                callback(new Error(message));
              } else {
                callback();
              }
            },
            trigger: "blur"
          }
        ];
        break;
      case "integer":
        addOrEditRules.value[column.key] = [
          {
            required: column.required,
            validator: (rule, value, callback) => {
              if (value && !isNumber(value)) {
                callback(new Error("field must be a number"));
              } else {
                callback();
              }
            },
            trigger: "blur"
          }
        ];
        break;
      default:
        addOrEditRules.value[column.key] = [
          {
            required: column.required,
            message: message,
            trigger: "blur"
          }
        ];
    }
  };

  const formatAddOrEditColumns = (columns: SearchColumnsResult["data"]) => {
    columns.forEach(column => {
      formatAddOrEditRules(column);
      const item: PageColumn = {
        _column: column,
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
        showOverflowTooltip: true,
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
          item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
          if (column.key === "pk") {
            item["minWidth"] = 80;
          }
          // item["fieldProps"]["controls"] = false;
          // pure-table ******
          // delete item["cellRenderer"];
          break;
        case "string":
        case "field":
          item["valueType"] = "input";
          break;
        case "color":
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
          item["renderField"] = renderBooleanSegmentedOption();
          item["width"] = 120;
          item["colProps"] = { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 };
          break;
        case "textarea":
          item["valueType"] = "textarea";
          item["fieldProps"] = { autosize: { minRows: 8 } };
          break;
        case "choice":
        case "multiple choice":
          item["valueType"] = "select";
          item["options"] = computed(() =>
            formatAddOrEditOptions(column?.choices, false)
          );
          if (column.input_type === "multiple choice") {
            item["fieldProps"]["multiple"] = true;
          }
          break;
        case "labeled_choice":
        case "labeled_multiple_choice":
        case "object_related_field":
        case "m2m_related_field":
          item["valueType"] = "select";
          item["options"] = computed(() =>
            formatAddOrEditOptions(column?.choices, true)
          );
          if (
            ["labeled_choice", "labeled_multiple_choice"].indexOf(
              column.input_type
            ) === -1
          ) {
            item["fieldProps"]["valueKey"] = "pk";
          }
          if (column.input_type === "labeled_multiple_choice") {
            item["fieldProps"]["multiple"] = true;
          }
          break;
        case "image upload":
        case "file upload":
          delete item["fieldProps"];
          item["renderField"] = (value, onChange) => {
            return h(UploadFile, {
              modelValue: value,
              isFile: column.input_type === "file upload",
              onChange: x => {
                onChange(x);
              }
            });
          };
          break;
        case "list":
          item["valueType"] = "select";
          item["renderField"] = (value: Array<any>, onChange) => {
            return h(TagInput, {
              modelValue: value,
              onChange: x => {
                onChange(x);
              }
            });
          };
          break;
        case "phone":
          column.default = { name: "China", code: "+86" };
          item["renderField"] = (value: any, onChange) => {
            return h(PhoneInput, {
              modelValue: value,
              onChange: x => {
                onChange(x);
              }
            });
          };
          break;
        case "json":
          item["renderField"] = (value: any, onChange) => {
            return h(JsonInput, {
              modelValue: value,
              onChange: x => {
                onChange(x);
              }
            });
          };
          break;
        default:
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
      }
      if (column.key === "description") {
        item.valueType = "textarea";
        item["fieldProps"] = { autosize: { minRows: 3 } };
      }
      if (!column.read_only) {
        addOrEditColumns.value.push(cloneDeep(item));
      }

      if (column.hasOwnProperty("default")) {
        addOrEditDefaultValue.value[column.key] = column?.default;
        if (column.input_type === "labeled_choice") {
          addOrEditDefaultValue.value[column.key] = { value: column?.default };
        }
        if (column.input_type === "labeled_multiple_choice") {
          addOrEditDefaultValue.value[column.key] = [
            { value: column?.default }
          ];
        }
        if (column.input_type === "multiple choice") {
          addOrEditDefaultValue.value[column.key] = [column?.default];
        }
      }
      if (!column.write_only) {
        let input_type = column.input_type;
        if (input_type.startsWith("api-search-")) {
          // 详情渲染自定义api-search
          input_type = "object_related_field";
          if (column.multiple) {
            input_type = "m2m_related_field";
          }
        }
        switch (input_type) {
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
            if (!isEmpty(column?.choices)) {
              item["prop"] = `${column.key}.pk`;
              item["options"] = computed(() =>
                formatAddOrEditOptions(column?.choices)
              );
            } else {
              item["valueType"] = "text";
              item["prop"] = `${column.key}.label`;
            }
            // pure-table ****** start
            item["cellRenderer"] = ({ row }) => (
              <span v-copy={get(row, `${column.key}.label`)}>
                {get(row, `${column.key}.label`)}
              </span>
            );
            // pure-table ****** end
            break;
          case "m2m_related_field":
          case "labeled_multiple_choice":
            item["render"] = (value: Array<any>) => {
              if (value instanceof Array) {
                return (
                  <>
                    <el-space>
                      {value?.map((item, index) => {
                        return (
                          <el-text
                            key={item.pk ?? item.value}
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
          case "json":
            // pure-table ****** start
            item["cellRenderer"] = ({ row }) => (
              <span>{JSON.stringify(row[column.key])}</span>
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
            // item["valueType"] = "switch";
            delete item["renderField"];
            // item["editable"] = true;
            break;
        }
        detailColumns.value.push(cloneDeep(item));
        if (column.table_show) {
          listColumns.value.push(cloneDeep(item));
        }
      }
    });
    listColumns.value = listColumns.value.sort(
      (a, b) => a._column.table_show - b._column.table_show
    );
  };

  /**
   * 该方法用于页面onMount内调用，用于第一次渲染页面
   */
  const getColumnData = (
    apiColumns: BaseApi["columns"],
    apiFields: BaseApi["fields"],
    columnsCallback = null,
    fieldsCallback = null,
    columnsParams = {},
    fieldsParams = {}
  ) => {
    if (apiColumns) {
      apiColumns(columnsParams).then(res => {
        detailColumns.value.splice(0, detailColumns.value.length);
        addOrEditColumns.value.splice(0, addOrEditColumns.value.length);
        listColumns.value.splice(0, listColumns.value.length);
        formatAddOrEditColumns(res.data);
        if (columnsCallback) {
          columnsCallback({
            listColumns,
            detailColumns,
            addOrEditRules,
            addOrEditColumns,
            addOrEditDefaultValue
          });
        }
      });
    }
    if (apiFields) {
      apiFields(fieldsParams).then(res => {
        searchColumns.value.splice(0, searchColumns.value.length);
        formatSearchColumns(res.data);
        if (fieldsCallback) {
          fieldsCallback({ searchDefaultValue, searchColumns });
        }
      });
    }
  };

  return {
    listColumns,
    detailColumns,
    searchColumns,
    getColumnData,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  };
}
