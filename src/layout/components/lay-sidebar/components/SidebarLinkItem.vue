<script lang="ts" setup>
import { computed } from "vue";
import { isUrl } from "@pureadmin/utils";
import { menuType } from "@/layout/types";

const props = defineProps<{
  to: menuType;
}>();

const isExternalLink = computed(() => isUrl(props.to.name ?? ""));

/** 菜单项携带的查询参数（后端 meta.query 解析对象）：附加到路由跳转上，如 /list?status=pending */
const menuQuery = computed<Record<string, string>>(() => {
  const query = props.to.meta?.query;
  return query && Object.keys(query).length > 0 ? query : {};
});

const getLinkProps = (item: menuType) => {
  if (isExternalLink.value) {
    return {
      href: item.name,
      target: "_blank",
      rel: "noopener"
    };
  }
  if (Object.keys(menuQuery.value).length > 0) {
    // path 取节点自身（目录节点由路由 redirect 兜底，与默认跳转语义一致）
    return {
      to: { path: item.path ?? item.redirect ?? "", query: menuQuery.value }
    };
  }
  return {
    to: item
  };
};
</script>

<template>
  <component
    :is="isExternalLink ? 'a' : 'router-link'"
    v-bind="getLinkProps(to)"
  >
    <slot />
  </component>
</template>
