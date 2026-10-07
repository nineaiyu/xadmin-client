import { describe, expect, it } from "vitest";

import { isIPv4, isIPv6 } from "../sampleIp";

/**
 * 样例 IP 严格校验：口径对齐服务端 `ipaddress.ip_address`
 * （`common/utils/ip/utils.py::is_ip_address`）——合法形态两侧一致，
 * 前端提前拦下畸形输入，避免预演出现「全部未命中」却无从解释的假象。
 */
describe("isIPv4", () => {
  it.each(["192.168.1.1", "0.0.0.0", "255.255.255.255", "10.0.0.1"])(
    "接受合法 IPv4：%s",
    value => {
      expect(isIPv4(value)).toBe(true);
    }
  );

  it.each([
    "256.1.1.1", // 段越界
    "1.2.3", // 段数不足
    "1.2.3.4.5", // 段数超出
    "01.2.3.4", // 前导零（Python ipaddress 拒绝）
    "1.2.3.04", // 前导零
    "1.2.3.4.", // 尾点
    "a.b.c.d", // 非数字
    "1.2.3.-4" // 负数
  ])("拒绝非法 IPv4：%s", value => {
    expect(isIPv4(value)).toBe(false);
  });
});

describe("isIPv6", () => {
  it.each([
    "2001:db8::1", // 常规压缩
    "::", // 全零地址
    "::1", // 环回
    "1:2:3:4:5:6:7:8", // 完整 8 组
    "1:2:3:4:5:6:7::", // :: 只压缩 1 组
    "2001:DB8:0:0:0:0:0:1", // 大写十六进制
    "::ffff:192.168.1.1", // IPv4 映射尾
    "1::1.2.3.4", // 压缩 + IPv4 尾
    "1:2:3:4:5:6:1.2.3.4" // 无压缩 + IPv4 尾（6 组 + 2 组折算）
  ])("接受合法 IPv6：%s", value => {
    expect(isIPv6(value)).toBe(true);
  });

  it.each([
    "192.168.1.1", // 纯 IPv4 不是 IPv6
    "1::2::3", // :: 压缩多于一处
    ":::", // 畸形连冒
    "::::",
    "1:2:", // 尾随单冒号
    ":1:2", // 首随单冒号
    "1:::2", // 三连冒（空组）
    "1:2:3:4:5:6:7:8:9", // 超 8 组
    "::1:2:3:4:5:6:7:8", // 压缩后仍超 8 组
    "12345::", // 组超 4 位十六进制
    "g::1", // 非十六进制字符
    "::ffff:1.2.3.256", // IPv4 尾段越界
    "::ffff:1.2.3.4:5", // IPv4 尾不在末组
    "fe80::1%eth0", // zone index 不是登录来源形态
    "1:2:3:4:5:1.2.3.4" // 组数不足（IPv4 尾折算后 7 组且未压缩）
  ])("拒绝非法 IPv6：%s", value => {
    expect(isIPv6(value)).toBe(false);
  });

  it("不把 CIDR / 区间 / 通配当样例地址（那是策略配置面写法）", () => {
    expect(isIPv6("2001:db8::/32")).toBe(false);
    expect(isIPv4("192.168.1.0/24")).toBe(false);
    expect(isIPv4("192.168.1.1-192.168.1.20")).toBe(false);
    expect(isIPv4("*")).toBe(false);
  });
});
