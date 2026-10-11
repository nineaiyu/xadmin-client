import type { Component, VNode } from "vue";
import { isFunction } from "@pureadmin/utils";
import type { MessageHandler } from "element-plus";
import { ElMessage } from "element-plus/es/components/message/index.mjs";

type messageStyle = "el" | "antd";
type messageTypes = "info" | "success" | "warning" | "error";
type messagePlacement =
  "top" | "top-left" | "top-right" | "bottom" | "bottom-left" | "bottom-right";

interface MessageParams {
  /** 消息类型，可选 `info` 、`success` 、`warning` 、`error` ，默认 `info` */
  type?: messageTypes;
  /** 是否纯色，默认 `false` */
  plain?: boolean;
  /** 自定义图标，该属性会覆盖 `type` 的图标 */
  icon?: string | Component;
  /** 是否将 `message` 属性作为 `HTML` 片段处理，默认 `false` */
  dangerouslyUseHTMLString?: boolean;
  /** 消息风格，可选 `el` 、`antd` ，默认 `antd` */
  customClass?: messageStyle;
  /** 显示时间，单位为毫秒。设为 `0` 则不会自动关闭，`element-plus` 默认是 `3000` ，平台改成默认 `2000` */
  duration?: number;
  /** 是否显示关闭按钮，默认值 `false` */
  showClose?: boolean;
  /** `Message` 消息距离窗口边缘的偏移量，默认 `16` */
  offset?: number;
  /** `Message` 消息放置位置，默认 `top` */
  placement?: messagePlacement;
  /** 设置组件的根元素，默认 `document.body` */
  appendTo?: string | HTMLElement;
  /** 合并内容相同的消息，不支持 `VNode` 类型的消息，默认值 `false` */
  grouping?: boolean;
  /** 重复次数，类似于 `Badge` 。当和 `grouping` 属性一起使用时作为初始数量使用，默认值 `1` */
  repeatNum?: number;
  /** 关闭时的回调函数, 参数为被关闭的 `message` 实例 */
  onClose?: (() => void) | null;
}

/** 用法非常简单，参考 src/views/components/message/index.vue 文件 */

/**
 * `Message` 消息提示函数
 */
const message = (
  message: string | VNode | (() => VNode),
  params?: MessageParams
): MessageHandler => {
  if (!params) {
    return ElMessage({
      message,
      customClass: "pure-message"
    });
  } else {
    const {
      icon,
      type = "info",
      plain = false,
      dangerouslyUseHTMLString = false,
      customClass = "antd",
      duration = 2000,
      showClose = false,
      offset = 16,
      placement = "top",
      appendTo = document.body,
      grouping = false,
      repeatNum = 1,
      onClose
    } = params;

    return ElMessage({
      message,
      icon,
      type,
      plain,
      dangerouslyUseHTMLString,
      duration,
      showClose,
      offset,
      placement,
      appendTo,
      grouping,
      repeatNum,
      // 全局搜 pure-message 即可知道该类的样式位置
      customClass: customClass === "antd" ? "pure-message" : "",
      onClose: () => (isFunction(onClose) ? onClose() : null)
    });
  }
};

/**
 * 关闭所有 `Message` 消息提示函数
 */
const closeAllMessage = (): void => ElMessage.closeAll();

/** 同 key 消息句柄表：同 key 的新消息展示前先关闭旧句柄（覆盖式反馈） */
const keyedHandlers = new Map<string, MessageHandler>();

/** 关闭指定 key 的挂起消息（不传则忽略） */
const closeKeyedMessage = (key: string): void => {
  const handler = keyedHandlers.get(key);
  if (handler) {
    handler.close();
    keyedHandlers.delete(key);
  }
};

/**
 * 覆盖式消息：以 `key` 为句柄键，同 key 的旧消息先关闭再展示新消息。
 * 用于「加载中 →（同 key）成功 / 失败」的串联反馈。
 */
const keyedMessage = (
  key: string,
  text: string | VNode,
  params?: MessageParams
): MessageHandler => {
  closeKeyedMessage(key);
  const handler = message(text, params);
  keyedHandlers.set(key, handler);
  return handler;
};

interface KeyedLoadingOptions<T> {
  /** 加载中文案（缺省则不展示加载态） */
  loading?: string;
  /** 成功文案（可传函数由结果生成；缺省则直接收尾关闭） */
  success?: string | ((result: T) => string);
  /** 失败文案（可传函数由错误生成；缺省取错误 message） */
  error?: string | ((error: unknown) => string);
}

/**
 * 以同 key 串联「加载中 → 成功 / 失败」的消息反馈：开始时展示 loading
 * （`duration: 0` 不自动关闭），结束时用同 key 覆盖为成功 / 失败。
 * 失败会展示错误消息并继续抛出（调用方可继续 catch）。
 */
async function withKeyedLoading<T>(
  key: string,
  task: Promise<T> | (() => Promise<T>),
  options: KeyedLoadingOptions<T> = {}
): Promise<T> {
  const { loading, success, error } = options;
  if (loading) {
    keyedMessage(key, loading, { type: "info", duration: 0, showClose: false });
  }
  try {
    const result = await (typeof task === "function" ? task() : task);
    if (success) {
      const text = typeof success === "function" ? success(result) : success;
      keyedMessage(key, text, { type: "success" });
    } else {
      closeKeyedMessage(key);
    }
    return result;
  } catch (err) {
    const text =
      typeof error === "function"
        ? error(err)
        : typeof error === "string" && error
          ? error
          : err instanceof Error
            ? err.message
            : String(err ?? "");
    keyedMessage(key, text, { type: "error" });
    throw err;
  }
}

export {
  message,
  closeAllMessage,
  keyedMessage,
  closeKeyedMessage,
  withKeyedLoading
};
export type { KeyedLoadingOptions };
