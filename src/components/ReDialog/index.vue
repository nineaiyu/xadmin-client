<script setup lang="ts">
import type { EventType, ArgsType, DialogOptions } from "./type";
import { closeDialog, dialogStore, getDialogUid } from "./store";
import { ref, computed } from "vue";
import { isFunction } from "@pureadmin/utils";
import Fullscreen from "~icons/ri/fullscreen-fill";
import ExitFullscreen from "~icons/ri/fullscreen-exit-fill";
import { useI18n } from "vue-i18n";
import { useOverlayFooter } from "@/components/overlay/useOverlayFooter";
import { useOverlayScrollLock } from "@/components/overlay/useOverlayScrollLock";
import { dialogDomProps } from "./attrs";

defineOptions({
  name: "ReDialog"
});

/**
 * 每个弹层的全屏运行时状态（按 uid 隔离，多弹层并存互不串扰）。
 * 未命中时回退 `options.fullscreen` 初始值；每次 `addDialog` 分配新 uid，
 * 因此重开弹层自然回到初始态。关闭时清理，避免无界累积。
 */
const fullscreenMap = ref<Record<string | number, boolean>>({});
const { t } = useI18n();

/**
 * 是否渲染自定义 `#header`：`headerRenderer` 自绘头部（调用方全权渲染，
 * 内部按钮无从插入），否则默认渲染「标题 + 全屏切换」头部，仅显式传
 * `fullscreenIcon: false` 关闭。
 */
const showFullscreenHeader = (options: DialogOptions) =>
  Boolean(options?.headerRenderer) || options?.fullscreenIcon !== false;

/** 当前弹层是否全屏（运行时状态优先，回退打开时的初始配置） */
const isFullscreen = (options: DialogOptions, index: number) =>
  fullscreenMap.value[getDialogUid(options) ?? index] ??
  options?.fullscreen ??
  false;

/** 全屏切换：只改当前弹层的运行时状态，不影响其它并存弹层 */
function toggleFullscreen(options: DialogOptions, index: number) {
  const uid = getDialogUid(options) ?? index;
  const next = !isFullscreen(options, index);
  fullscreenMap.value[uid] = next;
  eventsCallBack("fullscreenCallBack", { ...options, fullscreen: next }, index);
}

useOverlayScrollLock(dialogStore);

const {
  sureBtnMap,
  footerButtons,
  handleBeforeClose,
  handleClose: closeOverlay
} = useOverlayFooter<DialogOptions>({
  close: closeDialog,
  getUid: getDialogUid,
  t,
  clearRuntimeState: (options, index) => {
    const uid = getDialogUid(options) ?? index;
    delete fullscreenMap.value[uid];
  }
});

const fullscreenClass = computed(() => {
  return [
    "el-icon",
    "el-dialog__close",
    "-translate-x-2",
    "cursor-pointer",
    "hover:text-[red]!"
  ];
});

function eventsCallBack(
  event: EventType,
  options: DialogOptions,
  index: number
) {
  if (options?.[event] && isFunction(options?.[event])) {
    return options?.[event]({ options, index });
  }
}

function handleCloseDialog(
  options: DialogOptions,
  index: number,
  args?: ArgsType
) {
  closeOverlay(options, index, args);
}

function handleClose(
  options: DialogOptions,
  index: number,
  args: ArgsType = { command: "close" }
) {
  handleCloseDialog(options, index, args);
  eventsCallBack("close", options, index);
}

function handleChange(options: DialogOptions, index: number, values: unknown) {
  options?.onChange && options.onChange({ options, index, values });
}

/**
 * 内容组件 props：既有 `options.props` + （启用载荷通道时）注入 `getData/setData`。
 * 仅在显式传入 `payload` 的弹层注入，未传的弹层零影响
 * （避免未声明这两个 props 的内容组件把它们落到根元素 DOM 上）。
 */
function contentProps(options: DialogOptions) {
  if (!options.getData && !options.setData) return options?.props;
  return {
    ...options?.props,
    getData: options.getData,
    setData: options.setData
  };
}
</script>

<template>
  <el-dialog
    v-for="(options, index) in dialogStore"
    :key="getDialogUid(options) ?? index"
    v-bind="dialogDomProps(options)"
    v-model="options.visible"
    class="pure-dialog"
    :fullscreen="isFullscreen(options, index)"
    :close-on-press-escape="options.closeOnPressEscape ?? true"
    :before-close="
      (done: (cancel?: boolean) => void) => handleBeforeClose(options, done)
    "
    @closed="handleClose(options, index)"
    @opened="eventsCallBack('open', options, index)"
    @openAutoFocus="eventsCallBack('openAutoFocus', options, index)"
    @closeAutoFocus="eventsCallBack('closeAutoFocus', options, index)"
  >
    <!-- header -->
    <template
      v-if="showFullscreenHeader(options)"
      #header="{ close, titleId, titleClass }"
    >
      <component
        :is="options?.headerRenderer?.({ close, titleId, titleClass })"
        v-if="options?.headerRenderer"
      />
      <div v-else class="flex-bc">
        <span :id="titleId" :class="titleClass">{{ options?.title }}</span>
        <!-- 静态 fullscreen 选项 = 常驻全屏（无可切换按钮）；
             运行时全屏（点击切换）保留按钮，允许再点退出 -->
        <i
          v-if="!options?.fullscreen"
          :class="fullscreenClass"
          data-testid="dialog-fullscreen-toggle"
          @click="() => toggleFullscreen(options, index)"
        >
          <IconifyIconOffline
            class="pure-dialog-svg"
            :icon="isFullscreen(options, index) ? ExitFullscreen : Fullscreen"
          />
        </i>
      </div>
    </template>
    <component
      v-bind="contentProps(options)"
      :is="options.contentRenderer?.({ options, index })"
      @change="(values: unknown) => handleChange(options, index, values)"
      @close="
        (args: ArgsType) =>
          // 内容组件主动关闭同样走 beforeClose 守卫（与遮罩/ESC/右上角关闭同口径）：
          // 未保存改动的确认不能因关闭入口不同而被绕过；done(true) = 取消关闭
          handleBeforeClose(options, (cancel?: boolean) => {
            if (!cancel) handleClose(options, index, args);
          })
      "
    />
    <!-- footer -->
    <template v-if="!options?.hideFooter" #footer>
      <template v-if="options?.footerRenderer">
        <component :is="options?.footerRenderer({ options, index })" />
      </template>
      <span v-else>
        <template v-for="(btn, key) in footerButtons(options)" :key="key">
          <el-popconfirm
            v-if="btn.popconfirm"
            v-bind="btn.popconfirm"
            @confirm="
              btn.btnClick?.({
                dialog: { options, index },
                button: { btn, index: key }
              })
            "
          >
            <template #reference>
              <el-button v-bind="btn">{{ btn?.label }}</el-button>
            </template>
          </el-popconfirm>
          <el-button
            v-else
            v-bind="btn"
            :loading="
              btn.code === 'sure' &&
              sureBtnMap[getDialogUid(options) ?? index]?.loading
            "
            @click="
              btn.btnClick?.({
                dialog: { options, index },
                button: { btn, index: key }
              })
            "
          >
            {{ btn?.label }}
          </el-button>
        </template>
      </span>
    </template>
  </el-dialog>
</template>
