<script lang="ts" setup>
import { useRoute } from "vue-router";
import { computed, onBeforeMount, ref } from "vue";
import { deviceDetection, useGlobal } from "@pureadmin/utils";
import AccountSidebar from "./components/AccountSidebar.vue";
import TopCollapse from "@/layout/components/lay-sidebar/components/SidebarTopCollapse.vue";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { ReSplitPane } from "@/components/ReSplitPane";
import { useSplitPaneConfig } from "@/hooks/useSplitPaneConfig";
import { resolveInitialPane, syncTabQuery } from "./utils/tabQuery";
import { createAccountPanes } from "./utils/panes";

defineOptions({
  name: "Account"
});

const route = useRoute();
const isOpen = ref(!deviceDetection());
const { $storage } = useGlobal<GlobalPropertiesApi>();
onBeforeMount(() => {
  useDataThemeChange().dataThemeChange($storage.layout?.themeMode);
});
const { t } = useI18n();

// 侧栏宽度持久化（默认 15%，约等于原 210px 固定宽；双击分隔条或点悬浮按钮重置）
const { percent, handleDragEnd } = useSplitPaneConfig("account", {
  defaultPercent: 15,
  minPercent: 10
});

// 页签定义见 utils/panes.ts（auth 为页签级权限门）
const panes = computed(() => createAccountPanes(t, hasAuth));
/**
 * 页签定位：支持 `?tab=xxx` 直达（OAuth 绑定回调落地后回到「第三方账号」），
 * 非法/无权限的 key 一律回落「个人信息」，避免落到空白面板。
 */
const initialPane = () =>
  resolveInitialPane(panes.value, route.query.tab, "profile");
const currentPane = ref(initialPane());

/**
 * 切换页签：本地状态 + 地址栏 `?tab=` 同步（history.replaceState）。
 *
 * 同步走 replaceState 而非 `router.replace({query})`——后者会触发布局 afterEach
 * 的「按来源 path 取消在途请求」链路，把刚挂载面板的首屏请求一并中止（竞态、
 * 偶发空白），详见 utils/tabQuery.ts 的模块注释；刷新与分享链接因此可回到当前页签。
 */
const switchPane = (key: string) => {
  currentPane.value = key;
  syncTabQuery(key);
  if (deviceDetection()) {
    isOpen.value = !isOpen.value;
  }
};
</script>

<template>
  <!-- 桌面：侧栏宽度可拖拽（比例持久化到 WEB_SITE_CONFIG.SplitPanes） -->
  <el-container v-if="!deviceDetection()" class="h-full">
    <ReSplitPane
      v-model:percent="percent"
      :split-set="{ minPercent: 10, defaultPercent: 15, split: 'vertical' }"
      class="w-full"
      @drag-end="handleDragEnd"
    >
      <template #paneL>
        <div
          class="pure-account-settings h-full overflow-hidden px-2 dark:bg-(--el-bg-color)! border-r border-(--divider)"
        >
          <AccountSidebar
            :current-pane="currentPane"
            :panes="panes"
            @switch-pane="switchPane"
          />
        </div>
      </template>
      <template #paneR>
        <el-main class="account-pane">
          <component
            :is="panes.find(item => item.key === currentPane)?.component"
          />
        </el-main>
      </template>
    </ReSplitPane>
  </el-container>
  <!-- 移动端：侧栏抽屉式显隐 -->
  <el-container v-else class="h-full">
    <el-aside
      v-if="isOpen"
      width="180px"
      class="pure-account-settings overflow-hidden px-2 dark:bg-(--el-bg-color)! border-r border-(--divider)"
    >
      <AccountSidebar
        :current-pane="currentPane"
        :panes="panes"
        @switch-pane="switchPane"
      />
    </el-aside>
    <el-main class="account-pane">
      <TopCollapse
        :is-active="isOpen"
        class="px-0"
        @toggleClick="isOpen = !isOpen"
      />
      <component
        :is="panes.find(item => item.key === currentPane)?.component"
      />
    </el-main>
  </el-container>
</template>

<style lang="scss" scoped>
/**
 * 内容区留白：左右上下对齐面板留白规范。
 * 上边距取 12px 而非对称值——侧栏首行（返回）是 48px 行高的居中行，
 * 面板标题行需要落在同一条基线上，标题 26px 行高加 12px 上边距后中心与之齐平。
 */
.account-pane {
  padding: 12px 24px 16px;
}

@media (width <= 768px) {
  .account-pane {
    padding: 12px 12px 16px;
  }
}
</style>

<style lang="scss">
/**
 * 个人中心的侧栏皮肤（副作用到 EP 菜单内部样式，必须非 scoped）。
 *
 * 固定尺寸（48px 行高、4px 圆角）是有意为之：侧栏是「页签式导航」而非普通菜单，
 * 颜色一律取主题变量（`--pure-theme-menu-*` / `--el-color-*`），不写死色值——
 * 写死 #fff 会在自定义菜单色主题下与标题色撞车。
 */
.pure-account-settings {
  background: var(--pure-theme-menu-bg) !important;
}

.pure-account-settings-menu {
  background-color: transparent;
  border: none;

  .el-menu-item {
    height: 48px !important;
    color: var(--pure-theme-menu-text);
    background-color: transparent !important;
    transition: color 0.2s;

    &:hover {
      color: var(--pure-theme-menu-title-hover) !important;
    }

    &.is-active {
      color: var(--el-color-white) !important;

      &:hover {
        color: var(--el-color-white) !important;
      }

      &::before {
        position: absolute;
        inset: 0;
        clear: both;
        margin: 4px 0;
        content: "";
        background: var(--el-color-primary);
        border-radius: 3px;
      }
    }
  }
}

/**
 * 激活项白字的兜底：本页侧栏不在布局侧栏（`.sidebar-container`）作用域内，
 * 布局层的激活色规则压不到这里，因此需要在页内以**同等权重**兜底
 * （`body[layout]` + 两个类 = 0-3-1，足以压过 EP 与布局层的菜单色）。
 *
 * 选择器必须带 `.pure-account-settings` 锚点：早期写法直接写
 * `body[layout] .el-menu--vertical .is-active`，等于把规则挂到全站——会命中**主侧栏**的激活项
 * （实测主侧栏因布局层权重更高暂未受影响，但属随时可能生效的隐患）。
 */
body[layout] .pure-account-settings .el-menu--vertical .is-active {
  color: var(--el-color-white) !important;
  transition: color 0.2s;

  &:hover {
    color: var(--el-color-white) !important;
  }
}
</style>
