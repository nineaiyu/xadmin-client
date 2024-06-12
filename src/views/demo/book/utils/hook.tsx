import dayjs from "dayjs";
import Form from "../form.vue";
import { useI18n } from "vue-i18n";
import { bookApi } from "./api";
import { hasAuth } from "@/router/utils";
import type { PlusColumn } from "plus-pro-components";
import { reactive, ref, type Ref, shallowRef } from "vue";
import { formatFormColumns } from "@/views/system/hooks";
import { renderOption, renderSwitch } from "@/views/system/render";

export function useDemoBook(tableRef: Ref) {
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

  // 新增或更新的form表单
  const editForm = shallowRef({
    title: t("demoBook.book"),
    form: Form,
    row: {
      is_active: row => {
        return row?.is_active ?? true;
      }
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
        return scope.row.key;
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

  return {
    t,
    api,
    auth,
    columns,
    editForm
  };
}

export function useDemoBookForm(props) {
  const { t, te } = useI18n();
  //用于新增和更新的form表单字段配置
  const columns: PlusColumn[] = [
    {
      prop: "name",
      valueType: "input"
    },
    {
      prop: "isbn",
      valueType: "input"
    },
    {
      prop: "author",
      valueType: "input"
    },
    {
      prop: "publisher",
      valueType: "input"
    },
    {
      prop: "price",
      valueType: "input-number"
    },
    {
      prop: "publication_date",
      valueType: "date-picker"
    },
    {
      prop: "is_active",
      valueType: "radio",
      renderField: renderOption()
    },
    {
      prop: "description",
      valueType: "textarea"
    }
  ];
  // 自动格式化字段名称
  formatFormColumns(props, columns, t, te, "demoBook");
  return {
    t,
    columns
  };
}
