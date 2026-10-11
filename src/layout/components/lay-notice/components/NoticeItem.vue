<script lang="ts" setup>
import { ListItem } from "../data";
import { computed, nextTick, PropType, ref } from "vue";
import { useNav } from "@/layout/hooks/useNav";
import { deviceDetection } from "@pureadmin/utils";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";

const props = defineProps({
  noticeItem: {
    type: Object as PropType<ListItem>,
    default: () => {}
  },
  index: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits<{
  itemClick: [item: ListItem];
}>();

const titleRef = ref<HTMLElement | null>(null);
const titleTooltip = ref(false);
// const descriptionRef = ref(null);
// const descriptionTooltip = ref(false);
const { tooltipEffect } = useNav();
const isMobile = deviceDetection();
const { t } = useI18n();

function hoverTitle() {
  nextTick(() => {
    (titleRef.value?.scrollWidth ?? 0) > (titleRef.value?.clientWidth ?? 0)
      ? (titleTooltip.value = true)
      : (titleTooltip.value = false);
  });
}

const handleRead = (item: ListItem) => {
  emit("itemClick", item);
};

const divClass = computed(() => {
  return [
    "notice-container",
    props.index === 0 ? "" : "border-t-[1px]",
    "border-solid",
    "border-0",
    "border-border-lighter"
  ];
});
</script>

<template>
  <div :class="divClass">
    <el-avatar
      v-if="noticeItem.avatar"
      :size="30"
      :src="noticeItem.avatar"
      class="notice-container-avatar"
    />
    <div class="notice-container-text">
      <div class="notice-text-title text-fg dark:text-white">
        <el-tooltip
          :content="noticeItem.title"
          :disabled="!titleTooltip"
          :effect="tooltipEffect"
          :enterable="!isMobile"
          placement="top-start"
          popper-class="notice-title-popper"
        >
          <div
            ref="titleRef"
            class="notice-title-content"
            @mouseover="hoverTitle"
          >
            <el-text
              :type="noticeItem?.level?.value"
              @click="handleRead(noticeItem)"
              >{{ noticeItem.title }}
            </el-text>
          </div>
        </el-tooltip>
      </div>
      <div class="notice-text-datetime text-fg-muted dark:text-white">
        {{ dayjs(noticeItem.created_time).format(t("layout.noticeTime")) }}
      </div>
    </div>
  </div>
</template>

<style>
.notice-title-popper {
  max-width: 238px;
}
</style>
<style lang="scss" scoped>
.notice-container {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px 0;

  .notice-container-avatar {
    margin-right: 16px;
    background: hsl(var(--bg-card));
  }

  .notice-container-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-between;

    .notice-text-title {
      display: flex;
      margin-bottom: 4px;
      font-size: var(--font-size-base);
      font-weight: 400;
      line-height: 1.5715;
      cursor: pointer;

      .notice-title-content {
        flex: 1;
        width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .notice-title-extra {
        float: right;
        margin-top: -1.5px;
        font-weight: 400;
      }
    }

    .notice-text-description,
    .notice-text-datetime {
      font-size: var(--font-size-xs);
      line-height: 1.5715;
    }

    .notice-text-description {
      display: -webkit-box;
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .notice-text-datetime {
      margin-top: 4px;
    }
  }
}
</style>
