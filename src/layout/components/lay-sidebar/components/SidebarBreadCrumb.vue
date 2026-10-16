<script lang="ts" setup>
import { isEqual, useGlobal } from "@pureadmin/utils";
import type { menuType } from "@/layout/types";
import { transformI18n } from "@/plugins/i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useRoute, useRouter, type RouteRecordRaw } from "vue-router";
import { computed, onMounted, ref, toRaw, watch } from "vue";
import { findRouteByPath, getParentPaths, toMenuNode } from "@/router/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";

const route = useRoute();
const levelList = ref<menuType[]>([]);
const router = useRouter();
// options.routes 为 readonly，去除 readonly 以复用 findRouteByPath / getParentPaths 的签名
const routes = router.options.routes as RouteRecordRaw[];
const multiTags = useMultiTagsStoreHook().multiTags;
const { $storage } = useGlobal<GlobalPropertiesApi>();

/** 面包屑细分偏好（设置面板 →「布局」→「顶栏」） */
const breadcrumbShowIcon = computed(
  () => $storage?.configure?.breadcrumbShowIcon ?? true
);
const breadcrumbShowHome = computed(
  () => $storage?.configure?.breadcrumbShowHome ?? false
);
const breadcrumbHideOnlyOne = computed(
  () => $storage?.configure?.breadcrumbHideOnlyOne ?? false
);
const breadcrumbStyle = computed(
  () => $storage?.configure?.breadcrumbStyle ?? "normal"
);

/** 展示序列：可选前置首页项（当前已在首页时不重复） */
const displayList = computed(() => {
  const list = levelList.value;
  if (!breadcrumbShowHome.value) return list;
  if (list.length && ["/", "/welcome"].includes(list[0].path ?? "")) {
    return list;
  }
  // meta.title 存词条 key，由模板 transformI18n 统一翻译
  const home: menuType = {
    path: "/",
    value: undefined,
    meta: { title: "layout.breadcrumbHome" }
  };
  return [home, ...list];
});

/** 仅一项时隐藏：整条面包屑不渲染 */
const breadcrumbRendered = computed(
  () => !breadcrumbHideOnlyOne.value || displayList.value.length > 1
);

const getBreadcrumb = (): void => {
  // 当前路由信息
  let currentRoute: menuType = { value: undefined };

  if (Object.keys(route.query).length > 0) {
    multiTags.forEach(item => {
      if (isEqual(route.query, item?.query)) {
        currentRoute = toRaw(item) as menuType;
      }
    });
  } else if (Object.keys(route.params).length > 0) {
    multiTags.forEach(item => {
      if (isEqual(route.params, item?.params)) {
        currentRoute = toRaw(item) as menuType;
      }
    });
  } else {
    // findRouteByPath 返回路由树原始节点：经 toMenuNode 转为菜单消费面
    const node = findRouteByPath(router.currentRoute.value.path, routes);
    if (node) currentRoute = toMenuNode(node);
  }

  // 当前路由的父级路径组成的数组
  const parentRoutes = getParentPaths(
    router.currentRoute.value.name as string,
    routes,
    "name"
  );
  // 存放组成面包屑的数组
  const matched: menuType[] = [];

  // 获取每个父级路径对应的路由信息
  parentRoutes.forEach(path => {
    if (path === "/") return;
    const node = findRouteByPath(path, routes);
    if (node) matched.push(toMenuNode(node));
  });

  matched.push(currentRoute);

  matched.forEach((item, index) => {
    if (currentRoute?.query || currentRoute?.params) return;
    if (item?.children) {
      item.children.forEach(v => {
        if (v?.meta?.title === item?.meta?.title) {
          matched.splice(index, 1);
        }
      });
    }
  });

  levelList.value = matched.filter(item => item?.meta && item?.meta.title);
};

const handleLink = (item: menuType) => {
  const { redirect, name, path } = item;
  if (redirect) {
    router.push(redirect);
  } else {
    if (name) {
      if (item.query) {
        router.push({
          name,
          query: item.query
        });
      } else if (item.params) {
        router.push({
          name,
          params: item.params
        });
      } else {
        router.push({ name });
      }
    } else {
      router.push({ path });
    }
  }
};

onMounted(() => {
  getBreadcrumb();
});

watch(
  () => route.path,
  () => {
    getBreadcrumb();
  },
  {
    deep: true
  }
);
</script>

<template>
  <el-breadcrumb
    v-if="breadcrumbRendered"
    class="leading-12.5! select-none"
    :class="{ 'breadcrumb--background': breadcrumbStyle === 'background' }"
    separator="/"
  >
    <transition-group name="breadcrumb">
      <el-breadcrumb-item
        v-for="item in displayList"
        :key="item.path"
        class="inline! items-stretch!"
      >
        <a @click.prevent="handleLink(item)">
          <span
            v-if="breadcrumbShowIcon && item.meta?.icon"
            class="breadcrumb-icon"
            aria-hidden="true"
          >
            <component :is="useRenderIcon(toRaw(item.meta.icon))" />
          </span>
          {{ transformI18n(item.meta?.title ?? "") }}
        </a>
      </el-breadcrumb-item>
    </transition-group>
  </el-breadcrumb>
</template>

<style lang="scss" scoped>
/* 面包屑项图标：与文字同基线 */
.breadcrumb-icon {
  display: inline-flex;
  align-items: center;
  margin-right: 4px;
  vertical-align: middle;

  svg {
    width: 14px;
    height: 14px;
  }
}

/* 浅底样式（设置面板「面包屑样式」→「浅底」） */
.breadcrumb--background {
  padding: 3px 10px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius-md);
}
</style>
