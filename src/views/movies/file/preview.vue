<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import Player, { Events } from "xgplayer";
import "xgplayer/dist/index.min.css";
import { FormProps } from "./utils/types";
import { deviceDetection, throttle } from "@pureadmin/utils";
import { getFilePreviewUrlApi } from "@/api/movies/file";
import HlsJsPlugin from "xgplayer-hls.js";
import { message } from "@/utils/message";
import { useI18n } from "vue-i18n";
import { updateWatchHistoryTimesApi } from "@/api/movies/history";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    pk: "",
    name: "",
    file_id: "",
    autoplay: false,
    init: false
  })
});

const player = ref();
const newFormInline = ref(props.formInline);
const { t } = useI18n();

function getPreview() {
  getFilePreviewUrlApi(newFormInline.value.pk).then((res: any) => {
    if (res.code === 1000 && res.data.category === "video") {
      // https://h5player.bytedance.com/
      player.value = new Player({
        id: "mse",
        url: res.data.preview_url,
        volume: 0.6, // 初始音量
        autoplay: newFormInline.value.autoplay, // 自动播放
        videoInit: newFormInline.value.init,
        playsinline: true,
        startTime: res.data.times ?? 0,
        cors: false,
        plugins: [HlsJsPlugin],
        fluid: deviceDetection(),
        //传入倍速可选数组
        playbackRate: [0.5, 0.75, 1, 1.5, 2],
        defaultPlaybackRate: 1,
        fitVideoSize: "fixed",
        rotate: {
          //视频旋转按钮配置项
          innerRotate: true, //只旋转内部video
          clockwise: true // 旋转方向是否为顺时针
        },
        rotateFullscreen: true, // 样式横屏全屏
        // download: true, //设置download控件显示,
        pip: true, //画中画
        screenShot: {
          saveImg: true,
          quality: 0.92,
          type: "image/png",
          format: ".png"
        }, // 截图
        cssFullscreen: true, //网页样式全屏
        keyShortcut: true,
        keyShortcutStep: {
          //设置调整步长
          currentTime: 15, //播放进度调整步长，默认10秒
          volume: 0.2 //音量调整步长，默认0.1
        },
        definitionActive: "click"
      });
      // 监听网页全屏(即页面全屏)也是一样的逻辑
      player.value.on(Events.TIME_UPDATE, ({ currentTime }) => {
        updateVideoPlayTimes(currentTime, res.data.pk);
      });
    } else {
      message(t("MoviesFile.notVideo"), { type: "error" });
    }
  });
}

const updateVideoPlayTimes = throttle((times, pk) => {
  updateWatchHistoryTimesApi({ times, file_id: pk });
}, 5 * 1000);

onMounted(() => {
  getPreview();
});
onUnmounted(() => {
  if (player.value) {
    player.value.destroy();
    player.value = null;
  }
});
</script>

<template>
  <div>
    <meta name="referrer" content="no-referrer" />
    <div id="mse" />
  </div>
</template>
