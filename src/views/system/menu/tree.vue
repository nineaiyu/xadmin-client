<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { match } from "pinyin-pro";
import { getMenuFromPk } from "@/utils";
import { useVModel } from "@vueuse/core";
import { useApiAuth } from "./utils/hook";
import { isAllEmpty } from "@pureadmin/utils";
import { transformI18n } from "@/plugins/i18n";
import { Tree, TreeFormProps } from "./utils/types";
import { MenuChoices } from "@/views/system/constants";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { computed, getCurrentInstance, onMounted, ref, watch } from "vue";

import Back from "@iconify-icons/ep/back";
import Delete from "@iconify-icons/ep/delete";
import Refresh from "@iconify-icons/ep/refresh";
import Reset from "@iconify-icons/ri/restart-line";
import Right from "@iconify-icons/ep/bottom-right";
import ExpandIcon from "./svg/expand.svg?component";
import More2Fill from "@iconify-icons/ri/more-2-fill";
import UnExpandIcon from "./svg/unexpand.svg?component";
import DocumentAdd from "@iconify-icons/ep/document-add";

const { t } = useI18n();
const { locale } = useI18n();
const { auth } = useApiAuth();
const { proxy } = getCurrentInstance();

const treeRef = ref();
const searchValue = ref("");
const highlightMap = ref({});
const loading = ref(true);
const isExpand = ref(false);
const checkStrictly = ref(true);

// 声明 props 默认值
// 推荐阅读：https://cn.vuejs.org/guide/typescript/composition-api.html#typing-component-props
const props = withDefaults(defineProps<TreeFormProps>(), {
  treeData: () => [],
  defaultData: () => ({}),
  parentIds: () => [],
  formInline: () => ({
    menu_type: MenuChoices.DIRECTORY,
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
      fixed_tag: false,
      dynamic_level: 0
    }
  })
});

// 使用 vueuse 的双向绑定工具
const emit = defineEmits([
  "update:formInline",
  "update:parentIds",
  "getMenuData",
  "openDialog",
  "handleDelete",
  "addNewMenu",
  "handleDrag",
  "handleManyDelete"
]);

const formInline = useVModel(props, "formInline", emit);
const parentIds = useVModel(props, "parentIds", emit);

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
  const nodes = (proxy.$refs["treeRef"] as any)?.store._getAllNodes();
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].expanded = status;
  }
}

const handleDragEnd = (node, node2, position) => {
  emit("handleDrag", treeRef, node, node2, position);
};

/** 重置状态（选中状态、搜索框值、树初始化） */
function onReset() {
  highlightMap.value = {};
  searchValue.value = "";
  toggleRowExpansionAll(false);
  parentIds.value = [];
  Object.keys(formInline.value).forEach(param => {
    formInline.value[param] = props.defaultData[param];
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
    "!h-[20px]",
    "reset-margin",
    "!text-gray-500",
    "dark:!text-white",
    "dark:hover:!text-primary"
  ];
});

const handleDragDrop = (node1, node2, type) => {
  return !(type === "inner" && node2.data.menu_type === MenuChoices.PERMISSION);
};

watch(searchValue, val => {
  treeRef.value!.filter(val);
});

onMounted(() => {
  setTimeout(() => {
    toggleRowExpansionAll(true);
    loading.value = false;
  }, 500);
});
</script>

<template>
  <div class="h-full bg-bg_color">
    <el-card :body-style="{ padding: '8px' }">
      <div class="flex items-center h-[34px]">
        <p
          :title="t('menu.menus')"
          class="flex-1 ml-2 font-bold text-base truncate"
        >
          {{ t("menu.menus") }}
        </p>
        <el-button
          v-if="auth.create"
          class="ml-2"
          size="small"
          @click="emit('openDialog', 0)"
          >{{ t("buttons.add") }}
        </el-button>
        <el-input
          v-model="searchValue"
          :placeholder="t('menu.verifyTitle')"
          class="flex-1"
          clearable
          size="small"
        >
          <template #suffix>
            <el-icon class="el-input__icon">
              <IconifyIconOffline
                v-show="searchValue.length === 0"
                icon="ri:search-line"
              />
            </el-icon>
          </template>
        </el-input>
        <el-dropdown :hide-on-click="false">
          <IconifyIconOffline
            :icon="More2Fill"
            class="w-[28px] cursor-pointer"
            width="18px"
          />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>
                <el-button
                  :class="buttonClass"
                  :icon="useRenderIcon(isExpand ? ExpandIcon : UnExpandIcon)"
                  link
                  type="primary"
                  @click="toggleRowExpansionAll(!isExpand)"
                >
                  {{
                    isExpand ? t("buttons.collapseAll") : t("buttons.expendAll")
                  }}
                </el-button>
              </el-dropdown-item>
              <el-dropdown-item>
                <el-button
                  :class="buttonClass"
                  :icon="useRenderIcon(checkStrictly ? Back : Right)"
                  link
                  type="primary"
                  @click="checkStrictly = !checkStrictly"
                >
                  {{
                    checkStrictly
                      ? t("menu.checkUnStrictly")
                      : t("menu.checkStrictly")
                  }}
                </el-button>
              </el-dropdown-item>
              <el-dropdown-item>
                <el-button
                  :class="buttonClass"
                  :icon="useRenderIcon(Reset)"
                  link
                  type="primary"
                  @click="onReset"
                >
                  {{ t("buttons.reset") }}
                </el-button>
              </el-dropdown-item>
              <el-dropdown-item v-if="auth.list">
                <el-button
                  :class="buttonClass"
                  :icon="useRenderIcon(Refresh)"
                  link
                  type="primary"
                  @click="emit('getMenuData')"
                >
                  {{ t("buttons.reload") }}
                </el-button>
              </el-dropdown-item>
              <el-dropdown-item v-if="auth.batchDelete">
                <el-popconfirm
                  :title="t('buttons.confirmDelete')"
                  @confirm="emit('handleManyDelete', treeRef)"
                >
                  <template #reference>
                    <el-button
                      :class="buttonClass"
                      :icon="useRenderIcon(Delete)"
                      link
                      type="danger"
                    >
                      {{ t("buttons.batchDelete") }}
                    </el-button>
                  </template>
                </el-popconfirm>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-card>
    <div :style="{ height: `calc(100vh - 200px)` }" class="overflow-y-auto">
      <el-tree
        ref="treeRef"
        v-loading="loading"
        :allow-drop="handleDragDrop"
        :check-strictly="checkStrictly"
        :data="props.treeData"
        :default-expand-all="isExpand"
        :default-expanded-keys="parentIds"
        :draggable="auth.rank"
        :expand-on-click-node="false"
        :filter-node-method="filterMenuNode"
        :props="defaultProps"
        class="pb-5 pt-3"
        highlight-current
        node-key="pk"
        show-checkbox
        size="small"
        @node-drag-end="handleDragEnd"
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
              v-if="auth.create && data.menu_type !== MenuChoices.PERMISSION"
              :content="t('buttons.add')"
              class="box-item"
              effect="dark"
              placement="top-start"
            >
              <IconifyIconOffline
                :icon="DocumentAdd"
                class="set-icon"
                style="width: 26px; height: 20px; margin-left: 8px"
                @click.stop="emit('addNewMenu', treeRef, data)"
              />
            </el-tooltip>

            <el-popconfirm
              v-if="auth.delete"
              :title="t('buttons.confirmDelete')"
              @confirm.stop="emit('handleDelete', data)"
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
              v-if="data.menu_type === MenuChoices.PERMISSION"
              v-copy="data.path"
              style="margin-left: 10px"
              type="success"
            >
              {{ data.method }} {{ data.path }}
            </el-text>
          </span>
        </template>
      </el-tree>
    </div>
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

:deep(.is-disabled > .el-tree-node__content) {
  color: #fc0101;
}
</style>
