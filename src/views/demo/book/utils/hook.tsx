import { useI18n } from "vue-i18n";
import { bookApi } from "./api";
import { hasAuth } from "@/router/utils";
import { reactive } from "vue";

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

  return {
    t,
    api,
    auth
  };
}
