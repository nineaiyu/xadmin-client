<script setup lang="ts">
import type { EventType, ArgsType, ButtonProps, DialogOptions } from "./type";
import { closeDialog, dialogStore, getDialogUid } from "./store";
import { ref, computed, watch } from "vue";
import { isFunction } from "@pureadmin/utils";
import Fullscreen from "~icons/ri/fullscreen-fill";
import ExitFullscreen from "~icons/ri/fullscreen-exit-fill";
import { useI18n } from "vue-i18n";
import { getLayoutScrollElement } from "@/utils/dom";
import { useScrollLock } from "@/hooks/useScrollLock";

defineOptions({
  name: "ReDialog"
});

const sureBtnMap = ref<Record<string | number, { loading?: boolean }>>({});
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

/**
 * 弹层打开期间锁定布局滚动容器：防止背景滚动穿透，并以滚动条槽位预留
 * （`scrollbar-gutter`）避免关闭后内容横向跳动；独立页（无布局滚动容器）
 * 不重复锁定——EP 内置 lock-scroll 已锁 body，避免双重补偿。
 */
const overlayLocked = useScrollLock({ immediate: false });
watch(
  () => dialogStore.value.some(options => options.visible),
  visible => {
    if (!getLayoutScrollElement()) return;
    overlayLocked.value = visible;
  }
);
const footerButtons = computed(() => {
  return (options: DialogOptions) => {
    return (options?.footerButtons?.length ?? 0) > 0
      ? options.footerButtons
      : ([
          {
            label: t("buttons.cancel"),
            text: true,
            bg: true,
            btnClick: ({ dialog: { options, index } }) => {
              const done = () =>
                handleCloseDialog(options, index, { command: "cancel" });
              if (options?.beforeCancel && isFunction(options?.beforeCancel)) {
                options.beforeCancel(done, { options, index });
              } else {
                done();
              }
            }
          },
          {
            label: t("buttons.save"),
            type: "primary",
            text: true,
            bg: true,
            // 稳定标识：footer loading 按 code 判定（替代数组下标魔法数，
            // 自定义 footerButtons 时不会把转圈落到错误按钮上）
            code: "sure",
            popconfirm: options?.popconfirm,
            btnClick: ({ dialog: { options, index } }) => {
              // 以弹层唯一标识（回退下标）作为状态键，避免多弹层并存时下标漂移串状态
              const uid = getDialogUid(options) ?? index;
              if (options?.sureBtnLoading) {
                sureBtnMap.value[uid] = Object.assign(
                  {},
                  sureBtnMap.value[uid],
                  {
                    loading: true
                  }
                );
              }
              const closeLoading = () => {
                // 条目可能已被关闭路径删除（done() 先于 closeLoading 调用，
                // 如表单助手 finally 里补关 loading）：判空兜底，避免
                // "Cannot set properties of undefined" 把 finally 变成未捕获拒绝
                if (options?.sureBtnLoading && sureBtnMap.value[uid]) {
                  sureBtnMap.value[uid].loading = false;
                }
              };
              const done = () => {
                handleCloseDialog(options, index, { command: "sure" });
              };
              if (options?.beforeSure && isFunction(options?.beforeSure)) {
                options.beforeSure(done, { options, index, closeLoading });
              } else {
                done();
              }
            }
          }
        ] as Array<ButtonProps>);
  };
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
  const uid = getDialogUid(options) ?? index;
  // 关闭即清理该弹层的运行时状态（loading / 全屏），避免无界累积与重开残留
  delete sureBtnMap.value[uid];
  delete fullscreenMap.value[uid];
  closeDialog(options, index, args);
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
    v-bind="options"
    v-model="options.visible"
    class="pure-dialog"
    :fullscreen="isFullscreen(options, index)"
    :close-on-press-escape="options.closeOnPressEscape ?? true"
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
      @close="(args: ArgsType) => handleClose(options, index, args)"
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
