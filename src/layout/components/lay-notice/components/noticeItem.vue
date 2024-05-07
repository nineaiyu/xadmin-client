<script lang="ts" setup>
import { ListItem } from "../data";
import { nextTick, PropType, ref } from "vue";
import { useNav } from "@/layout/hooks/useNav";
import { deviceDetection } from "@pureadmin/utils";
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

defineProps({
  noticeItem: {
    type: Object as PropType<ListItem>,
    default: () => {}
  }
});

const titleRef = ref(null);
const titleTooltip = ref(false);
// const descriptionRef = ref(null);
// const descriptionTooltip = ref(false);
const { tooltipEffect } = useNav();
const isMobile = deviceDetection();
const { t } = useI18n();

function hoverTitle() {
  nextTick(() => {
    titleRef.value?.scrollWidth > titleRef.value?.clientWidth
      ? (titleTooltip.value = true)
      : (titleTooltip.value = false);
  });
}

const router = useRouter();

const handleRead = (pk: number) => {
  router.push({
    name: "UserNotice",
    query: { pk: pk }
  });
  // updateUserNoticeReadApi({ pks: [pk] }).then(res => {
  //   console.log(res);
  // });
};

// function hoverDescription(event, description) {
//   // currentWidth 为文本在页面中所占的宽度，创建标签，加入到页面，获取currentWidth ,最后在移除
//   const tempTag = document.createElement("span");
//   tempTag.innerText = description;
//   tempTag.className = "getDescriptionWidth";
//   document.querySelector("body").appendChild(tempTag);
//   const currentWidth = (
//     document.querySelector(".getDescriptionWidth") as HTMLSpanElement
//   ).offsetWidth;
//   document.querySelector(".getDescriptionWidth").remove();
//
//   // cellWidth为容器的宽度
//   const cellWidth = event.target.offsetWidth;
//
//   // 当文本宽度大于容器宽度两倍时，代表文本显示超过两行
//   currentWidth > 2 * cellWidth
//     ? (descriptionTooltip.value = true)
//     : (descriptionTooltip.value = false);
// }
</script>

<template>
  <div
    class="notice-container border-b-[1px] border-solid border-[#f0f0f0] dark:border-[#303030]"
  >
    <el-avatar
      v-if="noticeItem.avatar"
      :size="30"
      :src="noticeItem.avatar"
      class="notice-container-avatar"
    />
    <div class="notice-container-text">
      <div class="notice-text-title text-[#000000d9] dark:text-white">
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
              :type="noticeItem?.level"
              @click="handleRead(noticeItem.pk)"
              >{{ noticeItem.title }}
            </el-text>
          </div>
        </el-tooltip>
        <!--        <el-tag-->
        <!--          v-if="noticeItem?.extra"-->
        <!--          :type="noticeItem?.level"-->
        <!--          size="small"-->
        <!--          class="notice-title-extra"-->
        <!--        >-->
        <!--          {{ noticeItem?.extra }}-->
        <!--        </el-tag>-->
      </div>

      <!--      <el-tooltip-->
      <!--        popper-class="notice-title-popper"-->
      <!--        :effect="tooltipEffect"-->
      <!--        :disabled="!descriptionTooltip"-->
      <!--        :content="noticeItem.message"-->
      <!--        placement="top-start"-->
      <!--      >-->
      <!--        <div-->
      <!--          ref="descriptionRef"-->
      <!--          class="notice-text-description"-->
      <!--          @mouseover="hoverDescription($event, noticeItem.message)"-->
      <!--        >-->
      <!--          {{ noticeItem.message }}-->
      <!--        </div>-->
      <!--      </el-tooltip>-->
      <div class="notice-text-datetime text-[#00000073] dark:text-white">
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

  // border-bottom: 1px solid #f0f0f0;

  .notice-container-avatar {
    margin-right: 16px;
    background: #fff;
  }

  .notice-container-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-between;

    .notice-text-title {
      display: flex;
      margin-bottom: 4px;
      font-size: 14px;
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
      font-size: 12px;
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
