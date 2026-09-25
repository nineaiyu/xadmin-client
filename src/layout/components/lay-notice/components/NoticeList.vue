<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { PropType } from "vue";
import { ListItem } from "../data";
import NoticeItem from "./NoticeItem.vue";
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
    <NoticeItem
      v-for="(item, index) in list"
      :key="index"
      :noticeItem="item"
      :index="index"
    />
  </div>
  <ReEmpty v-else :image-size="100" :description="transformI18n(emptyText)" />
</template>
