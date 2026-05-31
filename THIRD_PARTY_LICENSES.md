# 第三方资源许可证

本项目使用了以下第三方开源资源,我们感谢作者并在此完整保留许可证声明。

---

## beautiful-html-templates(32 个 HTML 幻灯片模板)

- **来源**:[github.com/zarazhangrui/beautiful-html-templates](https://github.com/zarazhangrui/beautiful-html-templates)
- **作者**:Zara Zhang
- **许可证**:MIT License
- **版权年份**:2026
- **导入时间**:2026-05-09(AnySlide PR3)
- **使用方式**:整套 HTML 模板(单文件 deck)作为 `template_html` 字段灌入 templates 表,
  L1 fillL1Template 链路调 LLM 改写 demo 文字为用户主题,**不修改 CSS / JS 结构**。
- **受影响范围**:`src/lib/slides/templates/external/<slug>.html` 32 个文件,
  `public/templates/external/<slug>.png` 32 张截图

### 受影响的模板 ID(共 32 个)

```
8-bit-orbit / biennale-yellow / block-frame / blue-professional / bold-poster /
broadside / capsule / cartesian / cobalt-grid / coral / creative-mode /
daisy-days / editorial-tri-tone / grove / long-table / mat / monochrome /
neo-grid-bold / peoples-platform / pin-and-paper / pink-script / playful /
raw-grid / retro-windows / retro-zine / sakura-chroma / scatterbrain /
signal / soft-editorial / stencil-tablet / studio / vellum
```

### MIT License 全文

完整许可证文本见 `src/lib/slides/templates/external/LICENSE.txt`,核心条款:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.

每个 HTML 文件顶部已添加 attribution 注释,链接回原仓库。
