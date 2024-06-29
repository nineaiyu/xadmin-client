import dayjs from "dayjs";
import { useI18n } from "vue-i18n";
import { bookApi } from "./api";
import { hasAuth } from "@/router/utils";
import { h, onMounted, reactive, ref, type Ref, shallowRef } from "vue";
import { renderOption, renderSwitch } from "@/views/system/render";
import { formatOptions } from "@/views/system/hooks";
import SearchDepts from "@/views/system/base/searchDepts.vue";
import SearchRoles from "@/views/system/base/searchRoles.vue";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import uploadFile from "@/views/demo/book.back/utils/uploadFile.vue";

// 定义自定义搜索模板
const apiSearchComponents = {
  "api-search-depts": SearchDepts,
  "api-search-roles": SearchRoles,
  "api-search-users": SearchUsers
};

export function useDemoBook(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(bookApi);

  // 权限判断，用于判断是否有该权限
  const auth = reactive({
    list: hasAuth("list:demoBook1"),
    create: hasAuth("create:demoBook1"),
    delete: hasAuth("delete:demoBook1"),
    update: hasAuth("update:demoBook1"),
    export: hasAuth("export:demoBook1"),
    import: hasAuth("import:demoBook1"),
    batchDelete: hasAuth("batchDelete:demoBook1")
  });

  const addOrEditRules = ref({});
  const addOrEditColumns = ref([]);
  const addOrEditDefaultValue = ref({});
  // 新增或更新的form表单
  const editForm = shallowRef({
    title: t("demoBook.book"),
    formProps: {
      rules: () => {
        return addOrEditRules.value;
      }
    },
    row: addOrEditDefaultValue.value,
    columns: () => {
      return addOrEditColumns.value;
    }
  });
  //用于前端table字段展示，前两个，selection是固定的，用与控制多选
  const columns = ref<TableColumnList>([
    {
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      prop: "pk",
      minWidth: 100
    },
    {
      prop: "name",
      minWidth: 120,
      cellRenderer: ({ row }) => <span v-copy={row.name}>{row.name}</span>
    },
    {
      prop: "isbn",
      minWidth: 150,
      cellRenderer: ({ row }) => <span v-copy={row.isbn}>{row.isbn}</span>
    },
    {
      prop: "is_active",
      minWidth: 130,
      cellRenderer: renderSwitch(auth.update, tableRef, "is_active", scope => {
        return scope.row.name;
      })
    },
    {
      prop: "author",
      minWidth: 150
    },
    {
      prop: "publisher",
      minWidth: 150
    },
    {
      prop: "author",
      minWidth: 150
    },
    {
      prop: "price",
      minWidth: 150
    },
    {
      minWidth: 180,
      prop: "publication_date",
      formatter: ({ publication_date }) =>
        dayjs(publication_date).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      fixed: "right",
      width: 160,
      slot: "operation",
      hide: !(auth.update || auth.delete)
    }
  ]);

  const formatColumns = columns => {
    columns.forEach(column => {
      if (!column.read_only) {
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

        const item = {
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

        addOrEditColumns.value.push(item);
      }
    });
  };

  onMounted(() => {
    api.columns().then(res => {
      formatColumns(res.data);
    });
  });

  return {
    t,
    api,
    auth,
    columns,
    editForm
  };
}
