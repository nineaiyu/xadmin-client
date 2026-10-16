import { describe, expect, it } from "vitest";
import { escapeHtml, isSafeRichUrl, renderRichText } from "../richText";

/** 行内用例统一走 renderRichText（对外唯一入口：先转义再套标记），断言里剥掉段落包裹 */
const inline = (text: string) =>
  renderRichText(text).replace(/^<p>|<\/p>$/g, "");

describe("escapeHtml / isSafeRichUrl", () => {
  it("转义五个 HTML 元字符", () => {
    expect(escapeHtml(`<a href="x" data-y='z'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; data-y=&#39;z&#39;&gt;&amp;&lt;/a&gt;"
    );
  });

  it("外链只收 http(s)", () => {
    expect(isSafeRichUrl("https://a.com/x")).toBe(true);
    expect(isSafeRichUrl("http://a.com")).toBe(true);
    expect(isSafeRichUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeRichUrl("data:text/html,x")).toBe(false);
    expect(isSafeRichUrl("/relative")).toBe(false);
  });
});

describe("行内标记（经 renderRichText）", () => {
  it("粗体 / 斜体 / 下划线 / 删除线，粗体先于斜体", () => {
    expect(inline("**粗**")).toBe("<strong>粗</strong>");
    expect(inline("*斜*")).toBe("<em>斜</em>");
    expect(inline("__下__")).toBe("<u>下</u>");
    expect(inline("~~删~~")).toBe("<s>删</s>");
    expect(inline("**粗**与*斜*")).toBe("<strong>粗</strong>与<em>斜</em>");
  });

  it("行内颜色（3 / 6 位十六进制），非法颜色原样保留", () => {
    expect(inline("[c=#f00]红[/c]")).toBe('<span style="color:#f00">红</span>');
    for (const bad of ["[c=red]x[/c]", "[c=#12345]x[/c]", '[c="#f00"]x[/c]']) {
      expect(inline(bad)).toBe(escapeHtml(bad));
    }
  });

  it("链接与裸 URL 都成链，外链属性固定", () => {
    expect(inline("[官网](https://a.com)")).toBe(
      '<a href="https://a.com" target="_blank" rel="noopener noreferrer">官网</a>'
    );
    expect(inline("见 https://a.com/x 说明")).toBe(
      '见 <a href="https://a.com/x" target="_blank" rel="noopener noreferrer">https://a.com/x</a> 说明'
    );
  });

  it("图片走 http(s)，非 http(s) 原样保留文本", () => {
    expect(inline("![图](https://a.com/a.png)")).toBe(
      '<img src="https://a.com/a.png" alt="图" loading="lazy" />'
    );
    expect(renderRichText("![图](javascript:alert(1))")).toBe(
      "<p>![图](javascript:alert(1))</p>"
    );
  });

  it("链接地址里的引号被转义，不会逃出属性（属性值是实体，不是分隔符）", () => {
    const html = renderRichText('[x](https://a.com/?q="onmouseover=1)');
    expect(html).toContain("&quot;");
    expect(html).not.toContain('"onmouseover=1"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe("renderRichText（块级 + 行内）", () => {
  it("普通行成段落，行内换行仍是 <br>", () => {
    expect(renderRichText("第一行\n第二行")).toBe("<p>第一行<br>第二行</p>");
    expect(renderRichText("**粗**")).toBe("<p><strong>粗</strong></p>");
  });

  it("无序 / 有序列表按连续行成块，行内标记仍生效", () => {
    expect(renderRichText("- 甲\n- **乙**")).toBe(
      "<ul><li>甲</li><li><strong>乙</strong></li></ul>"
    );
    expect(renderRichText("1. 甲\n2. 乙")).toBe(
      "<ol><li>甲</li><li>乙</li></ol>"
    );
    // 列表后接普通行 → 列表收束、后续成段
    expect(renderRichText("- 甲\n尾巴")).toBe(
      "<ul><li>甲</li></ul><p>尾巴</p>"
    );
  });

  it("表格：首行表头 + 分隔行 + 数据行，单元格支持行内标记", () => {
    const html = renderRichText(
      "| 名称 | 值 |\n| --- | --- |\n| **甲** | 1 |\n| 乙 | 2 |"
    );
    expect(html).toBe(
      "<table><thead><tr><th>名称</th><th>值</th></tr></thead>" +
        "<tbody><tr><td><strong>甲</strong></td><td>1</td></tr>" +
        "<tr><td>乙</td><td>2</td></tr></tbody></table>"
    );
  });

  it("缺分隔行的竖线文本按普通段落处理（不成表）", () => {
    expect(renderRichText("| a | b |")).toBe("<p>| a | b |</p>");
  });

  it("外部 HTML 一律被转义（XSS 面收敛为零）", () => {
    const evil = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    const html = renderRichText(evil);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("转义后的实体不会被后续标记规则破坏", () => {
    expect(renderRichText("A & B **C**")).toBe(
      "<p>A &amp; B <strong>C</strong></p>"
    );
  });
});
