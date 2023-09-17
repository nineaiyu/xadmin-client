<script setup lang="ts">
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { ref, computed, watch, getCurrentInstance } from "vue";

import Reset from "@iconify-icons/ri/restart-line";
import Search from "@iconify-icons/ep/search";
import More2Fill from "@iconify-icons/ri/more-2-fill";
import ExpandIcon from "./svg/expand.svg?component";
import UnExpandIcon from "./svg/unexpand.svg?component";
import Refresh from "@iconify-icons/ep/refresh";

interface Tree {
  id: number;
  name: string;
  highlight?: boolean;
  children?: Tree[];
}
import { useMenu } from "./utils/hook";
import { useVModel } from "@vueuse/core";
import { FormProps } from "./utils/types";

const {
  treeData,
  defaultData,
  parentIds,
  getMenuData,
  openDialog,
  handleDelete,
  addNewMenu,
  handleDrag,
  handleManyDelete
} = useMenu();

const treeRef = ref();

const isExpand = ref(false);
const searchValue = ref("");
const highlightMap = ref({});
const { proxy } = getCurrentInstance();

const customNodeClass = data => {
  if (data.menu_type === 0) {
    return "is-penultimate";
  } else if (data.menu_type === 1) {
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
    "!h-[20px]",
    "reset-margin",
    "!text-gray-500",
    "dark:!text-white",
    "dark:hover:!text-primary"
  ];
});

// 声明 props 类型

// 声明 props 默认值
// 推荐阅读：https://cn.vuejs.org/guide/typescript/composition-api.html#typing-component-props
const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    menu_type: 0,
    parent: "",
    name: "",
    path: "",
    rank: 0,
    component: "",
    is_active: true,
    meta: {
      title: "",
      icon: "",
      r_svg_name: "",
      is_show_menu: true,
      is_show_parent: false,
      is_keepalive: false,
      frame_url: "",
      frame_loading: false,
      transition_enter: "",
      transition_leave: "",
      is_hidden_tag: false,
      dynamic_level: 0
    }
  })
});

// 使用 vueuse 的双向绑定工具
const emit = defineEmits(["update:formInline"]);
const formInline = useVModel(props, "formInline", emit);
const { locale } = useI18n();

const filterMenuNode = (value: string, data: any) => {
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
    (formInline as any).value[key] = value[key];
  });
  formInline.value.title = formInline.value.meta.title;
  const p_menus = getMenuFromPk(treeRef.value.data, value.pk);
  if (p_menus.length > 0) {
    formInline.value.parent_ids = p_menus.map(res => res.pk);
    parentIds.value = formInline.value.parent_ids;
  }
};

function nodeClick(value) {
  const nodeId = value.$treeNodeId;
  highlightMap.value[nodeId] = highlightMap.value[nodeId]?.highlight
    ? Object.assign({ id: nodeId }, highlightMap.value[nodeId], {
        highlight: false
      })
    : Object.assign({ id: nodeId }, highlightMap.value[nodeId], {
        highlight: true
      });
  Object.values(highlightMap.value).forEach((v: Tree) => {
    if (v.id !== nodeId) {
      v.highlight = false;
    }
  });
  initMenuData(value);
}

function toggleRowExpansionAll(status) {
  isExpand.value = status;
  const nodes = (proxy.$refs["treeRef"] as any).store._getAllNodes();
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].expanded = status;
  }
}

const handleDragEnd = (node, node2, position) => {
  handleDrag(treeRef, node, node2, position);
};

/** 重置状态（选中状态、搜索框值、树初始化） */
function onReset() {
  highlightMap.value = {};
  searchValue.value = "";
  toggleRowExpansionAll(false);
  parentIds.value = [];
  Object.keys(formInline.value).forEach(param => {
    formInline.value[param] = defaultData[param];
  });
}

import DocumentAdd from "@iconify-icons/ep/document-add";
import Delete from "@iconify-icons/ep/delete";
import { transformI18n } from "@/plugins/i18n";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { isAllEmpty } from "@pureadmin/utils";
import { match } from "pinyin-pro";
import { getMenuFromPk } from "@/utils";

const handleDragDrop = (node1, node2, type) => {
  return !(type === "inner" && node2.data.menu_type === 2);
};

watch(searchValue, val => {
  treeRef.value!.filter(val);
});
</script>

<template>
  <div class="h-full bg-bg_color" :style="{ minHeight: `calc(100vh - 133px)` }">
    <el-affix :offset="85">
      <el-card :body-style="{ padding: '8px' }">
        <div class="flex items-center h-[34px]">
          <p class="flex-1 ml-2 font-bold text-base truncate" title="菜单列表">
            菜单列表
          </p>
          <el-button
            size="small"
            class="ml-2"
            @click="openDialog(0)"
            v-if="hasAuth('create:systemMenu')"
            >添加节点</el-button
          >
          <el-input
            size="small"
            class="flex-1"
            v-model="searchValue"
            placeholder="请输入菜单名称"
            clearable
          >
            <template #suffix>
              <el-icon class="el-input__icon">
                <IconifyIconOffline
                  v-show="searchValue.length === 0"
                  :icon="Search"
                />
              </el-icon>
            </template>
          </el-input>
          <el-dropdown :hide-on-click="false">
            <IconifyIconOffline
              class="w-[28px] cursor-pointer"
              width="18px"
              :icon="More2Fill"
            />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>
                  <el-button
                    :class="buttonClass"
                    link
                    type="primary"
                    :icon="useRenderIcon(isExpand ? ExpandIcon : UnExpandIcon)"
                    @click="toggleRowExpansionAll(!isExpand)"
                  >
                    {{ isExpand ? "折叠全部" : "展开全部" }}
                  </el-button>
                </el-dropdown-item>
                <el-dropdown-item>
                  <el-button
                    :class="buttonClass"
                    link
                    type="primary"
                    :icon="useRenderIcon(Reset)"
                    @click="onReset"
                  >
                    重置状态
                  </el-button>
                </el-dropdown-item>
                <el-dropdown-item v-if="hasAuth('list:systemMenu')">
                  <el-button
                    :class="buttonClass"
                    link
                    type="primary"
                    :icon="useRenderIcon(Refresh)"
                    @click="getMenuData"
                  >
                    刷新菜单
                  </el-button>
                </el-dropdown-item>
                <el-dropdown-item v-if="hasAuth('manyDelete:systemMenu')">
                  <el-popconfirm
                    title="是否确认批量删除选中节点?"
                    @confirm="handleManyDelete(treeRef)"
                  >
                    <template #reference>
                      <el-button
                        :class="buttonClass"
                        link
                        type="danger"
                        :icon="useRenderIcon(Delete)"
                      >
                        批量删除
                      </el-button>
                    </template>
                  </el-popconfirm>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-card>
    </el-affix>
    <el-tree
      ref="treeRef"
      :data="treeData"
      node-key="pk"
      size="small"
      :props="defaultProps"
      show-checkbox
      check-strictly
      :expand-on-click-node="false"
      :default-expanded-keys="parentIds"
      :filter-node-method="filterMenuNode"
      @node-drag-end="handleDragEnd"
      :allow-drop="handleDragDrop"
      highlight-current
      :draggable="hasAuth('rank:systemMenu')"
      @node-click="nodeClick"
    >
      <template #default="{ node, data }">
        <span
          :class="[
            'pr-1',
            'rounded',
            'flex',
            'items-center',
            'select-none',
            searchValue.trim().length > 0 &&
              node.label.includes(searchValue) &&
              'text-red-500',
            highlightMap[node.id]?.highlight ? 'dark:text-primary' : ''
          ]"
          :style="{
            background: highlightMap[node.id]?.highlight
              ? 'var(--el-color-primary-light-7)'
              : 'transparent'
          }"
        >
          <component :is="useRenderIcon(data.meta.icon)" class="m-1" />
          {{ `${transformI18n(data.meta.title)}` }}
        </span>
        <span class="flex items-center">
          <el-tooltip
            class="box-item"
            effect="dark"
            content="添加节点"
            placement="top-start"
            v-if="hasAuth('create:systemMenu') && data.menu_type !== 2"
          >
            <IconifyIconOffline
              :icon="DocumentAdd"
              class="set-icon"
              style="width: 26px; height: 20px; margin-left: 8px"
              @click.stop="addNewMenu(treeRef, data)"
            />
          </el-tooltip>

          <el-popconfirm
            v-if="hasAuth('delete:systemMenu')"
            title="是否确认删除该节点?"
            @confirm.stop="handleDelete(data)"
          >
            <template #reference>
              <IconifyIconOffline
                :icon="Delete"
                class="set-icon"
                style="width: 26px; height: 20px; color: red"
              />
            </template>
          </el-popconfirm>
          <el-text
            v-if="data.menu_type === 2"
            type="success"
            style="margin-left: 10px"
          >
            {{ data.component }} {{ data.path }}
          </el-text>
        </span>
      </template>
    </el-tree>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-divider) {
  margin: 0;
}

:deep(.el-tree-node__content) {
  height: 30px;
  font-size: 16px;
  line-height: 30px;
}

:deep(.is-penultimate > .el-tree-node__content) {
  color: #626aef;
}

:deep(.is-permission > .el-tree-node__content) {
  color: #15a307;
}
</style>
