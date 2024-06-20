import { h, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { SearchFieldsResult } from "@/api/types";
import type { PlusColumn } from "plus-pro-components";
import { getPickerShortcuts } from "@/views/system/utils";
import SearchDepts from "@/views/system/base/searchDepts.vue";
import SearchRoles from "@/views/system/base/searchRoles.vue";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import { formatOptions, formatPublicLabels } from "@/views/system/hooks";

// 定义自定义搜索模板
const apiSearchComponents = {
  "api-search-depts": SearchDepts,
  "api-search-roles": SearchRoles,
  "api-search-users": SearchUsers
};

export const formatSearchColumns = (
  item: SearchFieldsResult["data"][0],
  localeName?: string,
  t?: Function,
  te?: Function
) => {
  const column: PlusColumn = {
    label: localeName
      ? formatPublicLabels(t, te, item.key, localeName)
      : item.key,
    prop: item.key,
    options: formatOptions(item.choices),
    valueType: "input"
  };
  switch (item.input_type) {
    case "text":
      column.valueType = "input";
      break;
    case "datetime":
      column.valueType = "date-picker";
      column.fieldProps = {
        valueFormat: "YYYY-MM-DD HH:mm:ss"
      };
      break;
    case "datetimerange":
      column.valueType = "date-picker";
      column.fieldProps = {
        shortcuts: getPickerShortcuts(),
        valueFormat: "YYYY-MM-DD HH:mm:ss",
        type: "datetimerange"
      };
      column.colProps = {
        xs: 24,
        sm: 24,
        md: 12,
        lg: 12,
        xl: 12
      };
      break;
    case "number":
      column.valueType = "input";
      column.rules = [
        {
          validator: (rule, value, callback) => {
            if (value !== "" && !/^\d+$/.test(value)) {
              callback(new Error("field must be a number"));
            }
          }
        }
      ];
      break;
    case "select-multiple":
      column.valueType = "select";
      column.fieldProps = {
        multiple: true
      };
      break;
    case "select-ordering":
      column.valueType = "select";
      const options = formatOptions(item.choices);
      options?.forEach(option => {
        const labels = option.label.split(" ");
        option.label = `${formatPublicLabels(t, te, labels[0] as string, localeName)} ${formatPublicLabels(t, te, labels[1] as string, localeName)}`;
      });
      column.options = options;
      break;
    default:
      if (item.input_type.startsWith("api-")) {
        column.renderField = (value, onChange) => {
          return h(apiSearchComponents[item.input_type], {
            modelValue: value,
            onChange
          });
        };
        column.colProps = {
          xs: 24,
          sm: 24,
          md: 12,
          lg: 12,
          xl: 12
        };
      }
      column.valueType = item.input_type;
  }
  return column;
};

export const getFieldsData = (
  fieldsApi: Function,
  searchFields: Ref,
  searchColumns: Ref,
  localeName?: string,
  page: number = 1,
  size: number = 10,
  ordering: string = "-created_time"
) => {
  return new Promise((resolve, reject) => {
    const { t, te } = useI18n();
    fieldsApi().then((res: SearchFieldsResult) => {
      if (res.code === 1000) {
        res.data.forEach(item => {
          if (item.input_type.startsWith("search")) {
            searchFields.value[item.key] = [];
          } else {
            searchFields.value[item.key] = "";
          }
          searchColumns.value.push(
            formatSearchColumns(item, localeName, t, te)
          );
          if (item.key === "ordering" && item.choices.length > 0) {
            searchFields.value[item.key] = item.choices[0].value;
          }
        });
        searchFields.value.page = page;
        searchFields.value.size = size;
        searchFields.value.ordering = searchFields.value.ordering ?? ordering;
        resolve(res);
      } else {
        reject(res);
      }
    });
  });
};
