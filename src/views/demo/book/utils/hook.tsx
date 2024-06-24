import { useI18n } from "vue-i18n";
import { bookApi } from "./api";
import { hasAuth } from "@/router/utils";
import { h, onMounted, reactive, ref } from "vue";
import { renderOption, selectOptions } from "@/views/system/render";
import { formatOptions } from "@/views/system/hooks";
import SearchDepts from "@/views/system/base/searchDepts.vue";
import SearchRoles from "@/views/system/base/searchRoles.vue";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import UploadFiles from "@/views/system/base/uploadFiles.vue";
import uploadFile from "@/views/demo/book/utils/uploadFile.vue";
import type { PlusColumn } from "plus-pro-components";
import { getPickerShortcuts } from "@/views/system/utils";
import { cloneDeep } from "@pureadmin/utils";

// 定义自定义搜索模板
const apiSearchComponents = {
  "api-search-depts": SearchDepts,
  "api-search-roles": SearchRoles,
  "api-search-users": SearchUsers,
  "api-upload-files": UploadFiles
};

export function useDemoBook() {
  const { t } = useI18n();

  const api = reactive(bookApi);

  // 权限判断，用于判断是否有该权限
  const auth = reactive({
    list: hasAuth("list:demoBook"),
    create: hasAuth("create:demoBook"),
    delete: hasAuth("delete:demoBook"),
    update: hasAuth("update:demoBook"),
    export: hasAuth("export:demoBook"),
    import: hasAuth("import:demoBook"),
    batchDelete: hasAuth("batchDelete:demoBook")
  });

  const addOrEditRules = ref({});
  const addOrEditColumns = ref([]);
  const addOrEditDefaultValue = ref({});
  const searchColumns = ref([]);
  const listColumns = ref([]);

  const formatSearchColumns = columns => {
    columns.forEach(column => {
      const item: PlusColumn = {
        label: column.label,
        prop: column.key,
        options: formatOptions(column.choices),
        valueType: "input"
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
                if (value !== "" && !/^\d+$/.test(value)) {
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
          // const options = formatOptions(column.choices);
          // options?.forEach(option => {
          //   const labels = option.label.split(" ");
          //   option.label = `${formatPublicLabels(t, te, labels[0] as string, localeName)} ${formatPublicLabels(t, te, labels[1] as string, localeName)}`;
          // });
          item.options = formatOptions(column.choices);
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
      searchColumns.value.push(item);
    });
  };

  const formatAddOrEditColumns = columns => {
    columns.forEach(column => {
      addOrEditRules.value[column.key] = [
        {
          required: column.required,
          message: column.label ?? column.key,
          trigger: "blur"
        }
      ];
      if (column.hasOwnProperty("default")) {
        addOrEditDefaultValue.value[column.key] = row => {
          return row[column.key] ?? column?.default;
        };
      }

      const item: PlusColumn = {
        prop: column.key,
        label: column.label,
        tooltip: column.help_text,
        fieldProps: {
          maxlength: column?.max_length,
          showWordLimit: true,
          multiple: column?.multiple
        }
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
          break;
        case "boolean":
          item["valueType"] = "radio";
          item["renderField"] = renderOption();
          break;
        case "textarea":
          item["valueType"] = "textarea";
          break;
        case "labeled_choice":
        case "object_related_field":
        case "m2m_related_field":
          item["valueType"] = "select";
          item["options"] = formatOptions(column?.choices);
          break;
        case "image upload":
        case "file upload":
          delete item["fieldProps"];
          item["renderField"] = (value, onChange) => {
            return h(uploadFile, {
              modelValue: value,
              isFile: column.input_type === "file upload",
              onChange
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
            break;
          case "object_related_field":
            item["prop"] = `${column.key}.pk`;
            break;
          case "m2m_related_field":
            item["prop"] = `${column.key}.pk`;
            break;
          case "image upload":
            item["valueType"] = "img";
            break;
          case "boolean":
            item["options"] = selectOptions;
            break;
        }
        listColumns.value.push(cloneDeep(item));
      }
    });
  };

  onMounted(() => {
    api.columns().then(res => {
      formatAddOrEditColumns(res.data);
      console.log(1111111, addOrEditColumns);
    });
    api.fields().then(res => {
      formatSearchColumns(res.data);
      console.log(2222222222, searchColumns);
    });
  });

  return {
    t,
    api,
    auth,
    listColumns,
    addOrEditRules,
    addOrEditColumns,
    addOrEditDefaultValue,
    searchColumns
  };
}
