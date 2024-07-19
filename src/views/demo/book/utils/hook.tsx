import { bookApi } from "./api";
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";

export function useDemoBook() {
  // 权限判断，用于判断是否有该权限
  const api = reactive(bookApi);
  const auth = reactive({
    list: hasAuth("list:demoBook"),
    create: hasAuth("create:demoBook"),
    delete: hasAuth("delete:demoBook"),
    update: hasAuth("update:demoBook"),
    export: hasAuth("export:demoBook"),
    import: hasAuth("import:demoBook"),
    batchDelete: hasAuth("batchDelete:demoBook")
  });

  return {
    api,
    auth
  };
}
