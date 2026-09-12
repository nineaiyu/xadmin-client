import { useI18n } from "vue-i18n";
import { match } from "pinyin-pro";
import { getMenuFromPk } from "@/utils";
import { isAllEmpty, isNullOrUnDef } from "@pureadmin/utils";
import { transformI18n } from "@/plugins/i18n";
import type { FormItemProps, Tree } from "./types";
import { MenuChoices } from "@/views/system/constants";
import { computed, getCurrentInstance, nextTick, ref, watch } from "vue";
import type { Ref } from "vue";
import type { TreeInstance, TreeNodeData } from "element-plus";

interface MenuTreeDeps {
  treeData: Ref<Tree[]>;
  defaultData: Partial<FormItemProps>;
  formInline: Ref<FormItemProps>;
  parentIds: Ref<unknown[]>;
  treeRef: Ref;
  emit: (event: string, ...args: unknown[]) => void;
}

/** 菜单树交互状态机：搜索过滤/高亮/展开折叠/拖拽约束/重置（拆分自 tree.vue） */
export function useMenuTree({
  treeData,
  defaultData,
  formInline,
  parentIds,
  treeRef,
  emit
}: MenuTreeDeps) {
  const { t } = useI18n();
  const { locale } = useI18n();
  const { proxy } = getCurrentInstance();

  const searchValue = ref("");
  const highlightMap = ref({});
  const loading = ref(true);
  const isExpand = ref(false);
  const checkStrictly = ref(true);

  const filterMenuNode = (value: string, data: TreeNodeData) => {
    if (!value) return true;
    return value
      ? transformI18n(data.meta?.title)
          .toLocaleLowerCase()
          .includes(value.toLocaleLowerCase().trim()) ||
          (locale.value === "zh" &&
            !isAllEmpty(
              match(
                transformI18n(data.meta?.title).toLocaleLowerCase(),
                value.toLocaleLowerCase().trim()
              )
            ))
      : false;
  };

  const initMenuData = value => {
    Object.keys(value).forEach(key => {
      // 树节点数据按键值整体回填表单，经索引签名逐键写入
      (formInline.value as FormItemProps & Record<string, unknown>)[key] =
        value[key];
    });
    formInline.value.title = formInline.value.meta.title;
    const p_menus = getMenuFromPk(treeRef.value.data, value.pk);
    if (p_menus.length > 0) {
      formInline.value.parent_ids = p_menus.map(res => res.pk);
      parentIds.value = formInline.value.parent_ids;
    }
  };

  function nodeClick(value) {
    // 键必须与模板读取口径一致：模板读的是 el-tree 节点的 node.id（= node-key="pk"），
    // 原实现用内部 $treeNodeId 写入，两者不同源导致高亮实际取不到值
    const nodeId = value.pk;
    highlightMap.value[nodeId] = highlightMap.value[nodeId]?.highlight
      ? Object.assign({}, highlightMap.value[nodeId], {
          pk: nodeId,
          highlight: false
        })
      : Object.assign({}, highlightMap.value[nodeId], {
          pk: nodeId,
          highlight: true
        });
    Object.values(highlightMap.value).forEach((v: Tree) => {
      if (v.pk !== nodeId) {
        v.highlight = false;
      }
    });
    initMenuData(value);
  }

  /** 递归收集需要展开/折叠的节点 pk（替代依赖 el-tree 私有 store._getAllNodes） */
  function collectNodePks(nodes: Tree[], all: boolean, changeType: number) {
    const pks: number[] = [];
    const walk = (list?: Tree[]) => {
      list?.forEach(node => {
        if ((all || node.menu_type === changeType) && !isNullOrUnDef(node.pk)) {
          pks.push(node.pk);
        }
        if (node.children?.length) walk(node.children);
      });
    };
    walk(nodes);
    return pks;
  }

  function toggleRowExpansionAll(status: boolean, all = false) {
    isExpand.value = status;
    let changeType = MenuChoices.MENU;
    if (status) changeType = MenuChoices.DIRECTORY;

    const tree = proxy.$refs["treeRef"] as TreeInstance | undefined;
    if (!tree?.getNode) return;
    // getNode 为 el-tree 公开 API，逐节点设置 expanded，避免私有 store 在升级后失效
    collectNodePks(treeData.value, all, changeType).forEach(pk => {
      const node = tree.getNode(pk);
      if (node) node.expanded = status;
    });
  }

  const handleDragEnd = (node, node2, position) => {
    emit("handleDrag", treeRef.value, node, node2, position);
  };

  /** 重置状态（选中状态、搜索框值、树初始化） */
  function onReset() {
    highlightMap.value = {};
    searchValue.value = "";
    toggleRowExpansionAll(!isExpand.value);
    parentIds.value = [];
    Object.keys(formInline.value).forEach(param => {
      formInline.value[param] = defaultData[param];
    });
  }

  const customNodeClass = data => {
    if (!data.is_active) {
      return "is-disabled";
    }
    if (data.menu_type === MenuChoices.DIRECTORY) {
      return "is-penultimate";
    } else if (data.menu_type === MenuChoices.MENU) {
      return "is-permission";
    }
    return null;
  };

  const defaultProps = {
    children: "children",
    class: customNodeClass
  };

  const buttonClass = computed(() => {
    return [
      "h-[20px]!",
      "reset-margin",
      "text-gray-500!",
      "dark:text-white!",
      "dark:hover:text-primary!"
    ];
  });

  const handleDragDrop = (node1, node2, type) => {
    return !(
      type === "inner" && node2.data.menu_type === MenuChoices.PERMISSION
    );
  };

  watch(searchValue, val => {
    treeRef.value!.filter(val);
  });

  // 数据到达后再展开目录并结束加载态：替代原固定 500ms 延时
  // （慢网不再提前结束 loading 造成白屏，快网不再空等）
  let expandInited = false;
  let hasTreeData = false;
  watch(
    () => treeData.value,
    val => {
      if (!val?.length) {
        // 首次仍为空说明请求尚未返回，保持 loading；已有数据后被清空才结束加载态
        if (hasTreeData) loading.value = false;
        return;
      }
      hasTreeData = true;
      if (!expandInited) {
        expandInited = true;
        // 首次加载默认展开目录层级，与原行为保持一致
        isExpand.value = true;
      }
      nextTick(() => {
        toggleRowExpansionAll(isExpand.value);
        loading.value = false;
      });
    },
    { immediate: true }
  );

  return {
    t,
    searchValue,
    highlightMap,
    loading,
    isExpand,
    checkStrictly,
    filterMenuNode,
    nodeClick,
    toggleRowExpansionAll,
    onReset,
    customNodeClass,
    defaultProps,
    buttonClass,
    handleDragDrop,
    handleDragEnd
  };
}
