import type { IconifyIcon } from "@iconify/types";
import type { iconType } from "../src/components/ReIcon/src/types";
import type { Component, DefineComponent, HTMLAttributes } from "vue";

type IconifyIconOfflineProps = {
  icon?: IconifyIcon | string | Component;
} & iconType &
  HTMLAttributes;

type IconifyIconOnlineProps = {
  icon?: string;
} & iconType &
  HTMLAttributes;

type FontIconProps = {
  icon?: string;
  /** `unicode` 引用模式 */
  uni?: boolean;
  /** `svg symbol` 引用模式 */
  svg?: boolean;
  iconType?: "uni" | "svg";
} & HTMLAttributes;

/** 权限控制组件公共 `Props` */
type AuthorityProps = {
  value?: string | string[];
};

declare module "vue" {
  /**
   * 自定义全局组件获得 `Volar` 提示
   */
  export interface GlobalComponents {
    IconifyIconOffline: DefineComponent<IconifyIconOfflineProps>;
    IconifyIconOnline: DefineComponent<IconifyIconOnlineProps>;
    FontIcon: DefineComponent<FontIconProps>;
    Auth: DefineComponent<AuthorityProps>;
  }

  /**
   * `$storage` 全局响应式存储对象（`element-plus/global` 已提供 `$message` 等全局属性的类型）
   */
  export interface ComponentCustomProperties {
    $storage: ResponsiveStorage;
  }
}

export {};
