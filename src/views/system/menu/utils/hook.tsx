import { message } from "@/utils/message";
import { menuApi } from "@/api/system/menu";
import { getCurrentInstance, onMounted, reactive, ref } from "vue";
import type { FormItemProps } from "./types";
import { cloneDeep, isEmpty, isNullOrUnDef } from "@pureadmin/utils";
import { getMenuOrderPk } from "@/utils";
import { FieldChoices, MenuChoices } from "@/views/system/constants";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { modelLabelFieldApi } from "@/api/system/field";
import { formatFiledAppParent } from "@/views/system/hooks";
import type { RecordType } from "plus-pro-components";
import { handleTree } from "@/utils/tree";
import { useMenuData } from "./useMenuData";
import { useMenuDialog } from "./useMenuDialog";
import { useMenuPermissions } from "./useMenuPermissions";

const defaultData: FormItemProps = {
  menu_type: MenuChoices.DIRECTORY,
  parent: "",
  name: "",
  path: "",
  rank: 0,
  component: "",
  method: "",
  model: [],
  is_active: true,
  meta: {
    title: "",
    icon: "",
    r_svg_name: "",
    is_show_menu: true,
    is_show_parent: false,
    is_keepalive: true,
    frame_url: "",
    frame_loading: false,
    transition_enter: "",
    transition_leave: "",
    is_hidden_tag: false,
    fixed_tag: false,
    dynamic_level: 0
  }
};

/**
 * 菜单视图组装入口（拆分自 519 行单体，行为与返回契约不变）：
 * - useMenuData         数据加载与增删（列表/字典/接口清单、单删/批删、导入导出）
 * - useMenuDialog       新增/编辑弹层（表单装配与保存）
 * - useMenuPermissions  权限码批量生成抽屉
 * 组装入口保留：拖拽排序（handleDrag）、组件路径清单空闲加载（getViews）、初始拉取。
 */
export function useMenu() {
  const api = reactive(menuApi);
  const auth = reactive({
    rank: false,
    permissions: false,
    apiUrl: false,
    ...getDefaultAuths(getCurrentInstance(), ["rank", "permissions", "apiUrl"])
  });
  const formRef = ref();
  const treeData = ref([]);
  const parentIds = ref([]);
  // menu choices 接口为字典形态：{ method: [...], menu_type: [...] }
  const choicesDict = ref<RecordType>({});
  const menuUrlList = ref([]);
  const viewList = ref({});
  const modelList = ref([]);
  const menuData = ref<FormItemProps>(cloneDeep(defaultData));
  const loading = ref(true);

  const {
    getMenuApiList,
    getMenuData,
    handleDelete,
    handleManyDelete,
    exportData,
    importData
  } = useMenuData({
    api,
    auth,
    loading,
    treeData,
    choicesDict,
    menuUrlList
  });

  const { openDialog, addNewMenu, handleConfirm } = useMenuDialog({
    api,
    auth,
    treeData,
    choicesDict,
    menuUrlList,
    viewList,
    modelList,
    parentIds,
    formRef,
    defaultData,
    getMenuData
  });

  const { handleAddPermissions } = useMenuPermissions({
    api,
    menuUrlList,
    getMenuData
  });

  const handleDrag = (treeRef, node, node2, position) => {
    const u_menu = node.data;
    if (position === "inner") {
      u_menu.parent = node2.data.pk;
    } else {
      u_menu.parent = node2.data.parent;
    }
    api
      .partialUpdate(u_menu.pk, u_menu)
      .then(res => {
        if (res.code === 1000) {
          api
            .rank(getMenuOrderPk(treeRef?.data))
            .then(res => {
              if (res.code === 1000) {
                message(res.detail, { type: "success" });
              } else {
                message(res.detail, { type: "error" });
                // 排序未生效：重拉数据，避免本地顺序与服务端不一致
                getMenuData();
              }
            })
            .catch(err => {
              message(err?.detail, { type: "error" });
              getMenuData();
            });
        } else {
          message(res.detail, { type: "error" });
          // 拖拽已改变本地树结构但后端未保存：重拉服务端数据回滚视图
          getMenuData();
        }
      })
      .catch(err => {
        // 请求异常（网络/权限）时同样回滚，避免"前端已移动、后端未保存"的假象
        message(err?.detail, { type: "error" });
        getMenuData();
      });
  };

  // 组件路径清单需逐个 import 视图组件才能读到其 name，成本高且仅用于下拉选项：
  // 幂等 + 首屏空闲后再加载，避免阻塞菜单页首屏
  let viewsLoading = false;
  const getViews = () => {
    if (viewsLoading) return;
    viewsLoading = true;
    const files = import.meta.glob<{ default: { name?: string } }>(
      "@/views/**/*.vue"
    );
    Object.keys(files).forEach((file: string) => {
      // 忽略 components 目录的文件，规定该目录下的文件为依赖组件，而不是页面组件
      if (!/\/components\//.test(file)) {
        files[file]().then(data => {
          if (
            isEmpty(data?.default?.name) ||
            isNullOrUnDef(data?.default?.name)
          ) {
            return;
          }
          viewList.value[
            file.replace(/(\.\/|\.vue)/g, "").replace("/src/views/", "")
          ] = data?.default?.name;
        });
      }
    });
  };

  onMounted(() => {
    getMenuApiList();
    getMenuData();
    // 组件路径清单体积大：延后到首屏空闲再加载（不支持 requestIdleCallback 的环境退回宏任务）
    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    if (typeof idle === "function") {
      idle(() => getViews());
    } else {
      setTimeout(getViews, 0);
    }
    if (hasAuth("list:SystemModelLabelField")) {
      modelLabelFieldApi
        .list({
          page: 1,
          size: 1000,
          parent: 0,
          field_type: FieldChoices.ROLE
        })
        .then(res => {
          if (res.code === 1000) {
            const results = [];
            res.data.results.forEach(item => {
              const value = { pk: item.pk, name: item.name, label: item.label };
              results.push({ ...value, value });
            });
            formatFiledAppParent(results);
            modelList.value = handleTree(results);
          }
        });
    }
  });

  return {
    auth,
    treeData,
    menuData,
    viewList,
    modelList,
    parentIds,
    choicesDict,
    menuUrlList,
    defaultData,
    addNewMenu,
    exportData,
    importData,
    handleDrag,
    openDialog,
    getMenuData,
    handleDelete,
    handleConfirm,
    handleManyDelete,
    handleAddPermissions
  };
}
