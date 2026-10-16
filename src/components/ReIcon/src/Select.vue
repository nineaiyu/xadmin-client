<script setup lang="ts">
import ReEmpty from "@/components/ReEmpty";
import { IconJson } from "@/components/ReIcon/data";
import { cloneDeep, isAllEmpty } from "@pureadmin/utils";
import { ref, computed, CSSProperties, watch } from "vue";
import Search from "~icons/ri/search-eye-line";
import { useI18n } from "vue-i18n";

import LocalIcon from "./localIcon";
import { ensureIconSet, isIconSetLoaded } from "./iconRegistry";
import { usePagination } from "@/hooks/usePagination";

type ParameterCSSProperties = (_item?: string) => CSSProperties | undefined;

defineOptions({
  name: "IconSelect"
});

const inputValue = defineModel({ type: String, default: "" });

const iconList = ref(IconJson);
const icon = ref();
const currentActiveType = ref("ep:");
// 深拷贝图标数据，前端做搜索
const copyIconList: Record<string, string[]> = cloneDeep(iconList.value);
// 每页显示35个图标
const PAGE_SIZE = 35;

// 搜索条件
const filterValue = ref("");
const { t } = useI18n();
const tabsList = [
  {
    label: "Element Plus",
    name: "ep:"
  },
  {
    label: "Remix Icon",
    name: "ri:"
  },
  {
    label: "Font Awesome 5 Solid",
    name: "fa-solid:"
  }
];

/** 当前图标集下的搜索结果（前端过滤；翻页与「总数变化回首页」由 usePagination 承担） */
const filteredIconList = computed(() =>
  copyIconList[currentActiveType.value].filter(i =>
    i.includes(filterValue.value)
  )
);

const {
  currentPage,
  paginationList: pageList,
  total: totalPage,
  setCurrentPage
} = usePagination(filteredIconList, PAGE_SIZE);

// 图标集本地懒加载：切 tab 即加载对应 set（构建期内置的同源 chunk，不访问在线图标 API），
// 加载完成前网格展示加载态——内网/离线部署下「选择器可用」与「图标可渲染」一致。
const currentSetLoaded = computed(() =>
  isIconSetLoaded(currentActiveType.value.replace(":", ""))
);
watch(
  () => currentActiveType.value,
  value => {
    void ensureIconSet(value.replace(":", ""));
  },
  { immediate: true }
);

const iconItemStyle = computed((): ParameterCSSProperties => {
  return item => {
    if (inputValue.value === currentActiveType.value + item) {
      return {
        borderColor: "var(--el-color-primary)",
        color: "var(--el-color-primary)"
      };
    }
  };
});

function setVal() {
  currentActiveType.value = inputValue.value.substring(
    0,
    inputValue.value.indexOf(":") + 1
  );
  icon.value = inputValue.value.substring(inputValue.value.indexOf(":") + 1);
}

function onBeforeEnter() {
  if (isAllEmpty(icon.value) || isAllEmpty(inputValue.value)) return;
  setVal();
  // 寻找当前图标在第几页（未命中回落首页）
  const curIconIndex = copyIconList[currentActiveType.value].findIndex(
    i => i === icon.value
  );
  setCurrentPage(
    curIconIndex < 0 ? 1 : Math.ceil((curIconIndex + 1) / PAGE_SIZE)
  );
}

function onAfterLeave() {
  filterValue.value = "";
}

function handleClick(pane: unknown) {
  const { props } = pane as { props: { name: string } };
  setCurrentPage(1);
  currentActiveType.value = props.name;
}

function onChangeIcon(item: string) {
  icon.value = item;
  inputValue.value = currentActiveType.value + item;
}

function onClear() {
  icon.value = "";
  inputValue.value = "";
}

watch(
  () => inputValue.value,
  val => val && setVal(),
  { immediate: true }
);
// 过滤条件变化即回首页（总数恰好不变时 usePagination 的 total 监听不会触发）
watch(
  () => filterValue.value,
  () => setCurrentPage(1)
);
</script>

<template>
  <div class="selector">
    <el-input v-model="inputValue" disabled>
      <template #append>
        <el-popover
          :width="350"
          trigger="click"
          popper-class="pure-popper"
          :popper-options="{
            placement: 'auto'
          }"
          @before-enter="onBeforeEnter"
          @after-leave="onAfterLeave"
        >
          <template #reference>
            <!-- 原生 button 触发器：可聚焦 + Enter / Space 触发打开（键盘可达） -->
            <button
              type="button"
              class="w-10 h-8 cursor-pointer flex-c border-0 bg-transparent"
              :aria-label="t('buttons.selectIcon')"
            >
              <IconifyIconOffline v-if="!icon" :icon="Search" />
              <LocalIcon v-else :icon="inputValue" />
            </button>
          </template>

          <el-input
            v-model="filterValue"
            class="px-2 pt-2"
            :placeholder="t('buttons.search')"
            clearable
          />

          <el-tabs v-model="currentActiveType" @tab-click="handleClick">
            <el-tab-pane
              v-for="(pane, index) in tabsList"
              :key="index"
              :label="pane.label"
              :name="pane.name"
            >
              <el-scrollbar v-loading="!currentSetLoaded" height="220px">
                <ul class="flex flex-wrap px-2! ml-2!">
                  <li
                    v-for="(item, key) in pageList"
                    :key="key"
                    class="mr-2 mt-1"
                  >
                    <!-- 图标项用原生 button：保留 ul > li 列表语义，键盘可聚焦与选择 -->
                    <button
                      type="button"
                      :title="item"
                      :aria-label="item"
                      class="icon-item p-2 cursor-pointer flex-c border border-border-light bg-transparent"
                      :style="iconItemStyle(item)"
                      @click="onChangeIcon(item)"
                    >
                      <LocalIcon
                        :icon="currentActiveType + item"
                        width="20px"
                        height="20px"
                      />
                    </button>
                  </li>
                </ul>
                <ReEmpty
                  v-show="pageList.length === 0"
                  :description="`${filterValue} ${t('layout.noData')}`"
                  size="small"
                />
              </el-scrollbar>
            </el-tab-pane>
          </el-tabs>

          <div
            class="w-full h-9 flex items-center overflow-auto border-t border-border-light"
          >
            <el-pagination
              class="flex-auto ml-2"
              :total="totalPage"
              :current-page="currentPage"
              :page-size="PAGE_SIZE"
              :pager-count="5"
              layout="pager"
              background
              size="small"
              @current-change="setCurrentPage"
            />
            <el-button
              class="justify-end mx-2!"
              type="danger"
              size="small"
              text
              bg
              @click="onClear"
            >
              {{ t("buttons.unSelectAll") }}
            </el-button>
          </div>
        </el-popover>
      </template>
    </el-input>
  </div>
</template>

<style lang="scss" scoped>
.icon-item {
  &:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
    transform: scaleX(1.05);
    transition: all var(--duration-slow) var(--ease-standard);
  }
}

:deep(.el-tabs__nav-next) {
  font-size: var(--font-size-base);
  line-height: 32px;
  box-shadow: -5px 0 5px -6px hsl(var(--fg) / 20%);
}

:deep(.el-tabs__nav-prev) {
  font-size: var(--font-size-base);
  line-height: 32px;
  box-shadow: 5px 0 5px -6px hsl(var(--fg) / 20%);
}

:deep(.el-input-group__append) {
  padding: 0;
}

:deep(.el-tabs__item) {
  height: 30px;
  font-size: var(--el-font-size-extra-small);
  font-weight: normal;
  line-height: 30px;
}

:deep(.el-tabs__header),
:deep(.el-tabs__nav-wrap) {
  position: static;
  margin: 0;
  box-shadow: var(--shadow-sm);
}

:deep(.el-tabs__nav-wrap::after) {
  height: 0;
}

:deep(.el-tabs__nav-wrap) {
  padding: 0 24px;
}

:deep(.el-tabs__content) {
  margin-top: 4px;
}
</style>
