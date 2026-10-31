<script lang="ts" setup>
import { getConfig } from "@/config";
import { useMultiFrame } from "@/layout/hooks/useMultiFrame";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { type Component, computed, shallowRef, watch } from "vue";
import { RouteLocationNormalizedLoaded } from "vue-router";
import type { RouteConfigs } from "@/layout/types";

const props = defineProps<{
  currRoute: RouteLocationNormalizedLoaded;
  currComp: Component;
}>();

const compList = shallowRef<[string, unknown][]>([]);
const { setMap, getMap, MAP, delMap } = useMultiFrame();

const keep = computed(() => {
  return (
    getConfig().KeepAlive &&
    props.currRoute.meta?.keepAlive &&
    !!props.currRoute.meta?.frameSrc
  );
});
// 避免重新渲染 LayFrame
const normalComp = computed(() => !keep.value && props.currComp);

// getter 取最新数组：`handleTags("equal")` 会整体替换 store 字段，直接传数组
// 引用会让 watch 继续观察旧数组，后续 push/splice 不再触发清理
watch(
  () => useMultiTagsStoreHook().multiTags,
  (tags: RouteConfigs[]) => {
    // 清理不依赖当前路由形态：关掉 iframe 页签时用户可能正停在普通页面，
    // 若以 keep 为门禁则缓存组件与远端资源会一直驻留到下次进入 iframe 路由
    if (!Array.isArray(tags)) {
      return;
    }
    // 用集合差集判定关闭：数量相等但「关一个、开一个」时也要清理旧缓存
    const activePaths = new Set(
      tags
        .filter(i => i.meta?.frameSrc)
        .map(i => String((i as { fullPath?: string }).fullPath ?? i.path ?? ""))
    );
    let changed = false;
    for (const i of MAP.keys()) {
      if (!activePaths.has(i)) {
        delMap(i);
        changed = true;
      }
    }
    if (changed) compList.value = getMap() as [string, unknown][];
  }
);

watch(
  () => props.currRoute.fullPath,
  path => {
    const multiTags = useMultiTagsStoreHook().multiTags as RouteConfigs[];
    const iframeTags = multiTags.filter(i => i.meta?.frameSrc);
    if (keep.value) {
      if (iframeTags.length !== MAP.size) {
        const sameKey = [...MAP.keys()].find(i => path === i);
        if (!sameKey) {
          // 添加缓存
          setMap(path, props.currComp);
        }
      }
    }

    if (MAP.size > 0) {
      compList.value = getMap() as [string, unknown][];
    }
  },
  {
    immediate: true
  }
);
</script>
<template>
  <template v-for="[fullPath, Comp] in compList" :key="fullPath">
    <div v-show="fullPath === currRoute.fullPath" class="size-full">
      <slot
        :Comp="Comp"
        :frameInfo="{ frameSrc: currRoute.meta?.frameSrc, fullPath }"
        :fullPath="fullPath"
      />
    </div>
  </template>
  <div v-show="!keep" class="size-full">
    <slot :Comp="normalComp" :fullPath="currRoute.fullPath" frameInfo />
  </div>
</template>
