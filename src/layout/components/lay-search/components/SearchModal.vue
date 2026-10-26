<script lang="ts" setup>
import OverlayDialog from "@/components/overlay/OverlayDialog.vue";
import ReEmpty from "@/components/ReEmpty";
import { isSuccess } from "@/api/types";
import { match } from "pinyin-pro";
import { useI18n } from "vue-i18n";
import { getConfig } from "@/config";
import { useRouter } from "vue-router";
import SearchResult from "./SearchResult.vue";
import SearchFooter from "./SearchFooter.vue";
import { useNav } from "@/layout/hooks/useNav";
import { useCommandPalette } from "../useCommandPalette";
import { transformI18n } from "@/plugins/i18n";
import SearchHistory from "./SearchHistory.vue";
import type { dragItem, optionsItem } from "../types";
import { computed, ref, shallowRef, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { cloneDeep, isAllEmpty, storageLocal } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { searchGlobal, type GlobalSearchGroup } from "@/api/system/search";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import SearchIcon from "~icons/ri/search-line";
import AskAiIcon from "~icons/ri/robot-2-line";

interface Props {
  /** 弹窗显隐 */
  value: boolean;
}

const { device, t } = useNav();
const emit = defineEmits<{
  "update:value": [val: boolean];
}>();
const props = withDefaults(defineProps<Props>(), {});

const router = useRouter();
const { locale } = useI18n();

const HISTORY_TYPE = "history";
const COLLECT_TYPE = "collect";
const LOCALEHISTORYKEY = "menu-search-history";
const LOCALECOLLECTKEY = "menu-search-collect";

const keyword = ref("");
const resultRef = ref();
const historyRef = ref();
const scrollbarRef = ref();
const activePath = ref("");
const historyPath = ref("");
// 全局搜索权限点：无权限时不触发跨实体检索请求（否则用户输入即 403），
// 菜单检索与命令面板不依赖该权限，不受影响。
// 必须用 computed：路由/授权异步注册完成前组件可能已挂载，一次性求值会把
// 「暂时没权限」固化为永久关闭（全局搜索静默失效）。
const globalSearchAuth = computed(() => hasAuth("retrieve:SystemGlobalSearch"));
// 「问 AI」入口权限：与 AI 控制台问答入口（docs）同一权限点，无权限不出现
const askAiAuth = computed(() => hasAuth("ask:AiAssistant"));
const resultOptions = shallowRef<optionsItem[]>([]);
const historyOptions = shallowRef<optionsItem[]>([]);
// 全局搜索：菜单结果之外跨实体检索的分组结果
const globalGroups = shallowRef<GlobalSearchGroup[]>([]);
const globalLoading = ref(false);
const handleSearch = useDebounceFn(search, 300);
const historyNum = getConfig().MenuSearchHistory;
const inputRef = ref<HTMLInputElement | null>(null);

const menusData = computed(() => {
  return cloneDeep(usePermissionStoreHook().wholeMenus);
});

const show = computed({
  get() {
    return props.value;
  },
  set(val: boolean) {
    emit("update:value", val);
  }
});

watch(
  () => props.value,
  newValue => {
    if (newValue) getHistory();
  }
);

/** 命令面板：Cmd/Ctrl+K 唤起 + 快捷动作 + 键盘全导航（实现见 useCommandPalette） */
const {
  commandItems,
  commandActive,
  globalActive,
  askAiActive,
  handleEnter,
  runQuickAction
} = useCommandPalette({
  t,
  router,
  show,
  keyword,
  resultOptions,
  historyOptions,
  globalGroups,
  activePath,
  historyPath,
  askAiVisible: computed(() => askAiAuth.value && keyword.value.trim() !== ""),
  scrollTo,
  goGlobalResult,
  runAskAi,
  saveHistory,
  updateHistory,
  handleClose
});

const showSearchResult = computed(() => {
  return keyword.value && resultOptions.value.length > 0;
});

const showSearchHistory = computed(() => {
  return !keyword.value && historyOptions.value.length > 0;
});

const showEmpty = computed(() => {
  return (
    (!keyword.value &&
      historyOptions.value.length === 0 &&
      commandItems.value.length === 0) ||
    (keyword.value &&
      resultOptions.value.length === 0 &&
      globalGroups.value.length === 0 &&
      // 「问 AI」可见时即使零命中也有可执行出口，不算空态
      !(askAiAuth.value && keyword.value.trim() !== ""))
  );
});

function getStorageItem(key: string) {
  return storageLocal().getItem<optionsItem[]>(key) || [];
}

function setStorageItem(key: string, value: optionsItem[]) {
  storageLocal().setItem(key, value);
}

/** 将菜单树形结构扁平化为一维数组，用于菜单查询 */
function flatTree(arr: optionsItem[]) {
  const res: optionsItem[] = [];

  function deep(arr: optionsItem[], parentIcon?: string) {
    arr.forEach(item => {
      if (!item.children || item.children.length === 0) {
        const menuItem =
          !item.meta?.icon && parentIcon
            ? { ...item, meta: { ...item.meta, icon: parentIcon } }
            : item;
        res.push(menuItem);
      } else {
        deep(item.children, item.meta?.icon);
      }
    });
  }

  deep(arr);
  return res;
}

/** 查询 */
async function search() {
  const flatMenusData = flatTree(menusData.value);
  resultOptions.value = flatMenusData.filter(menu =>
    keyword.value
      ? transformI18n(menu.meta?.title)
          .toLocaleLowerCase()
          .includes(keyword.value.toLocaleLowerCase().trim()) ||
        (locale.value === "zh" &&
          !isAllEmpty(
            match(
              transformI18n(menu.meta?.title).toLocaleLowerCase(),
              keyword.value.toLocaleLowerCase().trim()
            )
          ))
      : false
  );
  activePath.value =
    resultOptions.value?.length > 0 ? resultOptions.value[0].path : "";
  await fetchGlobalResults();
}

/** 全局搜索：跨实体检索，失败静默降级为仅菜单结果 */
async function fetchGlobalResults() {
  if (!globalSearchAuth.value) return;
  const kw = keyword.value.trim();
  if (!kw) {
    globalGroups.value = [];
    return;
  }
  globalLoading.value = true;
  try {
    const res = await searchGlobal(kw);
    globalGroups.value = isSuccess(res) ? res.data.groups : [];
  } catch {
    globalGroups.value = [];
  } finally {
    globalLoading.value = false;
  }
}

/** 跳转到命中实体对应的页面：有承接字段时携带关键词（列表页 routeParams
 *  装配自动过滤到命中），无承接字段跳转由该页面自身的搜索能力承接 */
function goGlobalResult(group: GlobalSearchGroup) {
  const keywordQuery = group.search_field
    ? { [group.search_field]: keyword.value.trim() }
    : {};
  router.push({ path: group.route, query: keywordQuery });
  handleClose();
}

/** 问 AI：跳 AI 控制台问答入口并携带搜索词（控制台读 query 预填输入框） */
function runAskAi() {
  const question = keyword.value.trim();
  if (!question) return;
  router.push({ path: "/integration/ai/index", query: { q: question } });
  handleClose();
}

function handleClose() {
  show.value = false;
  /** 延时处理防止用户看到某些操作 */
  setTimeout(() => {
    resultOptions.value = [];
    historyPath.value = "";
    keyword.value = "";
    globalGroups.value = [];
  }, 200);
}

function scrollTo(index: number) {
  const ref = resultOptions.value.length ? resultRef.value : historyRef.value;
  const scrollTop = ref.handleScroll(index);
  scrollbarRef.value.setScrollTop(scrollTop);
}

/** 删除历史记录 */
function handleDelete(item: optionsItem) {
  const key = item.type === HISTORY_TYPE ? LOCALEHISTORYKEY : LOCALECOLLECTKEY;
  let list = getStorageItem(key);
  list = list.filter(listItem => listItem.path !== item.path);
  setStorageItem(key, list);
  getHistory();
}

/** 收藏历史记录 */
function handleCollect(item: optionsItem) {
  let searchHistoryList = getStorageItem(LOCALEHISTORYKEY);
  let searchCollectList = getStorageItem(LOCALECOLLECTKEY);
  searchHistoryList = searchHistoryList.filter(
    historyItem => historyItem.path !== item.path
  );
  setStorageItem(LOCALEHISTORYKEY, searchHistoryList);
  if (!searchCollectList.some(collectItem => collectItem.path === item.path)) {
    searchCollectList.unshift({ ...item, type: COLLECT_TYPE });
    setStorageItem(LOCALECOLLECTKEY, searchCollectList);
  }
  getHistory();
}

/** 存储搜索记录 */
function saveHistory() {
  const found = resultOptions.value.find(
    item => item.path === activePath.value
  );
  if (!found) return;
  const { path, meta } = found;
  const searchHistoryList = getStorageItem(LOCALEHISTORYKEY);
  const searchCollectList = getStorageItem(LOCALECOLLECTKEY);
  const isCollected = searchCollectList.some(item => item.path === path);
  const existingIndex = searchHistoryList.findIndex(item => item.path === path);
  if (!isCollected) {
    if (existingIndex !== -1) searchHistoryList.splice(existingIndex, 1);
    if (searchHistoryList.length >= (historyNum ?? 0)) searchHistoryList.pop();
    searchHistoryList.unshift({ path, meta, type: HISTORY_TYPE });
    storageLocal().setItem(LOCALEHISTORYKEY, searchHistoryList);
  }
}

/** 更新存储的搜索记录 */
function updateHistory() {
  let searchHistoryList = getStorageItem(LOCALEHISTORYKEY);
  const historyIndex = searchHistoryList.findIndex(
    item => item.path === historyPath.value
  );
  if (historyIndex !== -1) {
    const [historyItem] = searchHistoryList.splice(historyIndex, 1);
    searchHistoryList.unshift(historyItem);
    setStorageItem(LOCALEHISTORYKEY, searchHistoryList);
  }
}

/** 获取本地历史记录 */
function getHistory() {
  const searchHistoryList = getStorageItem(LOCALEHISTORYKEY);
  const searchCollectList = getStorageItem(LOCALECOLLECTKEY);
  historyOptions.value = [...searchHistoryList, ...searchCollectList];
  historyPath.value = historyOptions.value[0]?.path;
}

/** 拖拽改变收藏顺序 */
function handleDrag(item: dragItem) {
  const searchCollectList = getStorageItem(LOCALECOLLECTKEY);
  const [reorderedItem] = searchCollectList.splice(item.oldIndex, 1);
  searchCollectList.splice(item.newIndex, 0, reorderedItem);
  storageLocal().setItem(LOCALECOLLECTKEY, searchCollectList);
  historyOptions.value = [
    ...getStorageItem(LOCALEHISTORYKEY),
    ...getStorageItem(LOCALECOLLECTKEY)
  ];
  historyPath.value = reorderedItem.path;
}
</script>

<template>
  <OverlayDialog
    v-model="show"
    :before-close="handleClose"
    :show-close="false"
    :style="{
      borderRadius: '6px'
    }"
    :width="device === 'mobile' ? '80vw' : '40vw'"
    append-to-body
    class="pure-search-dialog"
    top="5vh"
    @closed="inputRef?.blur()"
    @opened="inputRef?.focus()"
  >
    <el-input
      ref="inputRef"
      v-model="keyword"
      :placeholder="t('layout.searchPlaceholder')"
      clearable
      size="large"
      @input="handleSearch"
    >
      <template #prefix>
        <IconifyIconOffline :icon="SearchIcon" class="text-primary size-6" />
      </template>
    </el-input>
    <div class="search-content">
      <el-scrollbar ref="scrollbarRef" max-height="calc(90vh - 140px)">
        <!-- 命令面板：无关键字时的快捷动作（键盘 ↑↓ 可达，Enter 执行） -->
        <div
          v-if="!keyword && commandItems.length"
          data-testid="command-palette"
        >
          <div class="px-5 py-1.5 text-xs text-(--el-text-color-secondary)">
            {{ t("commandPalette.title") }}
          </div>
          <div
            v-for="item in commandItems"
            :key="item.id"
            class="mx-2.5 my-0.5 flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-sm hover:bg-fill-muted"
            :class="{
              'bg-fill-muted': commandActive === item.id
            }"
            :data-testid="`command-${item.id.replace('cmd:', '')}`"
            :data-active="commandActive === item.id ? 'true' : undefined"
            @click="runQuickAction(item.id)"
          >
            <component :is="useRenderIcon(item.icon)" class="size-4" />
            <span class="truncate text-gray-900 dark:text-white">
              {{ item.title }}
            </span>
          </div>
        </div>
        <ReEmpty v-if="showEmpty" :description="t('layout.noData')" />
        <SearchHistory
          v-if="showSearchHistory"
          ref="historyRef"
          v-model:value="historyPath"
          :options="historyOptions"
          @click="handleEnter"
          @collect="handleCollect"
          @delete="handleDelete"
          @drag="handleDrag"
        />
        <SearchResult
          v-if="showSearchResult"
          ref="resultRef"
          v-model:value="activePath"
          :options="resultOptions"
          @click="handleEnter"
        />
        <div v-if="globalSearchAuth && keyword && globalGroups.length">
          <div class="px-5 py-1.5 text-xs text-(--el-text-color-secondary)">
            {{ t("search.globalResult") }}
          </div>
          <div v-for="group in globalGroups" :key="group.key">
            <div
              class="flex-bc px-5 py-1 text-xs text-(--el-text-color-secondary)"
            >
              <span>{{ group.label }}</span>
              <span>{{ group.total }}</span>
            </div>
            <div
              v-for="item in group.items"
              :key="item.pk"
              class="mx-2.5 my-0.5 flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-sm hover:bg-fill-muted"
              :class="{
                'bg-fill-muted':
                  globalActive === `global:${group.key}:${item.pk}`
              }"
              :data-testid="`global-search-item-${group.key}`"
              @click="goGlobalResult(group)"
            >
              <span class="truncate text-gray-900 dark:text-white">
                {{ item.text }}
              </span>
            </div>
          </div>
        </div>
        <!-- 问 AI：搜索词不是菜单/实体命中时的自然语言出口（权限同问答入口） -->
        <div
          v-if="askAiAuth && keyword"
          data-testid="ask-ai-entry"
          :data-active="askAiActive ? 'true' : undefined"
        >
          <div class="px-5 py-1.5 text-xs text-(--el-text-color-secondary)">
            {{ t("commandPalette.askAi") }}
          </div>
          <div
            class="mx-2.5 my-0.5 flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-sm hover:bg-fill-muted"
            :class="{ 'bg-fill-muted': askAiActive }"
            @click="runAskAi"
          >
            <IconifyIconOffline :icon="AskAiIcon" class="size-4 text-primary" />
            <span class="truncate text-gray-900 dark:text-white">
              {{ keyword.trim() }}
            </span>
          </div>
        </div>
      </el-scrollbar>
    </div>
    <template #footer>
      <SearchFooter :total="resultOptions.length" />
    </template>
  </OverlayDialog>
</template>

<style lang="scss" scoped>
.search-content {
  margin-top: 12px;
}
</style>
