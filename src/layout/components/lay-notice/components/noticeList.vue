<script lang="ts" setup>
import { PropType } from "vue";
import { ListItem } from "../data";
import NoticeItem from "./noticeItem.vue";
import { transformI18n } from "@/plugins/i18n";

defineProps({
  list: {
    type: Array as PropType<Array<ListItem>>,
    default: () => []
  },
  emptyText: {
    type: String,
    default: ""
  }
});
</script>

<template>
  <div v-if="list.length">
    <NoticeItem v-for="(item, index) in list" :key="index" :noticeItem="item" />
  </div>
  <el-empty v-else :description="transformI18n(emptyText)" />
</template>
