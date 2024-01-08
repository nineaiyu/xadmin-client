<script setup lang="ts">
import { PropType } from "vue";
import { ListItem } from "./data";
import NoticeItem from "./noticeItem.vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  list: {
    type: Array as PropType<Array<ListItem>>,
    default: () => []
  }
});
const { t } = useI18n();
</script>

<template>
  <div v-if="props.list.length">
    <NoticeItem
      v-for="(item, index) in props.list"
      :key="index"
      :noticeItem="item"
    />
  </div>
  <el-empty v-else :description="t('layout.noData')" />
</template>
