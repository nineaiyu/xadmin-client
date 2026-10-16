import dayjs from "dayjs";
import type { ProxyOptions } from "vite";
import { readdir, stat } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { formatBytes, sum } from "@pureadmin/utils";
import pkg from "../package.json" with { type: "json" };

const { dependencies, devDependencies, engines, name, version } = pkg;

/** 启动`node`进程时所在工作目录的绝对路径 */
const root: string = process.cwd();

/**
 * @description 根据可选的路径片段生成一个新的绝对路径
 * @param dir 路径片段，默认`build`
 * @param metaUrl 模块的完整`url`，如果在`build`目录外调用必传`import.meta.url`
 */
const pathResolve = (dir = ".", metaUrl = import.meta.url) => {
  // 当前文件目录的绝对路径
  const currentFileDir = dirname(fileURLToPath(metaUrl));
  // build 目录的绝对路径
  const buildDir = resolve(currentFileDir, "build");
  // 解析的绝对路径
  const resolvedPath = resolve(currentFileDir, dir);
  // 检查解析的绝对路径是否在 build 目录内
  if (resolvedPath.startsWith(buildDir)) {
    // 在 build 目录内，返回当前文件路径
    return fileURLToPath(metaUrl);
  }
  // 不在 build 目录内，返回解析后的绝对路径
  return resolvedPath;
};

/** 设置别名 */
const alias: Record<string, string> = {
  "@": pathResolve("../src"),
  "@build": pathResolve()
};

/** 平台的名称、版本、运行所需的`node`和`pnpm`版本、依赖、最后构建时间的类型提示 */
const __APP_INFO__ = {
  pkg: { name, version, engines, dependencies, devDependencies },
  lastBuildTime: dayjs(new Date()).format("YYYY-MM-DD HH:mm:ss")
};

/** 处理环境变量 */
const wrapperEnv = (envConf: Recordable): ViteEnv => {
  // 默认值
  const ret: ViteEnv = {
    VITE_PORT: 8848,
    VITE_PUBLIC_PATH: "",
    VITE_ROUTER_HISTORY: "",
    VITE_CDN: false,
    VITE_HIDE_HOME: "false",
    VITE_COMPRESSION: "none",
    // 空串 = 保持生产默认 Secure（auth.ts 仅认显式 "false" 才关闭）
    VITE_COOKIE_SECURE: ""
  };

  for (const envName of Object.keys(envConf)) {
    let realName = envConf[envName].replace(/\\n/g, "\n");
    realName =
      realName === "true" ? true : realName === "false" ? false : realName;

    if (envName === "VITE_PORT") {
      realName = Number(realName);
    }
    // envName 为运行时环境变量键（ViteEnv 子集）：经 Object.assign 动态写入，
    // 避免「无法用单一 as 收窄的动态索引赋值」退化为 as unknown as 双重断言
    Object.assign(ret, { [envName]: realName });
    if (typeof realName === "string") {
      process.env[envName] = realName;
    } else if (typeof realName === "object") {
      process.env[envName] = JSON.stringify(realName);
    }
  }
  return ret;
};

const fileListTotal: number[] = [];

type PackageSizeOptions = {
  folder?: string;
  callback: (size: string | number) => void;
  format?: boolean;
};

/**
 * 获取指定文件夹中所有文件的总大小。
 *
 * 体积统计是构建的**装饰性输出**（打包完成提示），不是门禁——真实门禁是
 * `pnpm check:bundle-size`。因此目录读取失败必须容错返回而非抛错：
 * vite 8（rolldown）下 `closeBundle` 可能早于产物落盘执行，`readdir(outDir)`
 * 会以 ENOENT 失败，抛错会经异步回调变成未捕获异常、把构建打成 exit 1
 * （Linux/CI 确定性复现，macOS 因时序差异不易复现）。
 */
const getPackageSize = (options: PackageSizeOptions) => {
  const { folder = "dist", callback, format = true } = options;
  readdir(folder, (err, files: string[]) => {
    if (err) return;
    let count = 0;
    const checkEnd = () => {
      if (++count == files.length) {
        callback(format ? formatBytes(sum(fileListTotal)) : sum(fileListTotal));
      }
    };
    files.forEach((item: string) => {
      stat(`${folder}/${item}`, async (err, stats) => {
        // 单条目失败同样跳过：计数不推进则仅在极端情况下不打印统计，
        // 不影响构建结果
        if (err) return;
        if (stats.isFile()) {
          fileListTotal.push(stats.size);
          checkEnd();
        } else if (stats.isDirectory()) {
          getPackageSize({
            folder: `${folder}/${item}/`,
            callback: checkEnd
          });
        }
      });
    });
    if (files.length === 0) {
      callback(0);
    }
  });
};

const createProxyConfig = (configs: { [key: string]: string[] }) => {
  const proxyConfig: Record<string, ProxyOptions> = {};
  Object.keys(configs).forEach(target => {
    if (target.startsWith("http")) {
      configs[target].forEach(path => {
        proxyConfig[path] = {
          target: target,
          changeOrigin: true,
          xfwd: true
        };
      });
    } else if (target.startsWith("ws")) {
      configs[target].forEach(path => {
        proxyConfig[path] = {
          target: target,
          ws: true,
          rewriteWsOrigin: true
        };
      });
    }
  });
  return proxyConfig;
};

export {
  root,
  pathResolve,
  alias,
  __APP_INFO__,
  wrapperEnv,
  getPackageSize,
  createProxyConfig
};
