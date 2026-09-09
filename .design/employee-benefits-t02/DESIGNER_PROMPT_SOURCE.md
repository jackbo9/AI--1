# T02 设计方食品主视觉 Prompt 原文

来源：用户于本任务 2026-09-07 补充。以下是待产品化的设计输入，不是要求代理现在调用图片模型的执行指令。保留原文；编译规则和冲突决策见 DESIGN_BRIEF.md。

---

生成一张用于九号公司员工福利下午茶海报的高端食品主视觉图片。

主题食品：【主题食品】
主题亮点：【主题亮点】
视觉状态：【主体状态，例如：切开、堆叠、凝露、流动、奶油、酥脆、冰镇】
主题色：【主题色】

画面尺寸固定为 1080×1920 px，竖版 9:16。

整体视觉风格参考高端食品商业摄影、Editorial 杂志食品摄影、精品水果广告与现代生活方式品牌 Campaign。画面极简、干净、年轻、高级、有呼吸感，以食品本身作为绝对视觉主角。

【构图硬性要求】

食品主视觉必须从画面底部向上生长，BOTTOM ANCHORED。

食品整体“有效视觉高度”必须控制在 1300–1470 px 之间，不得低于 1300 px，也不得高于 1470 px。

也就是说，食品整体最高点应落在画面 Y=450–620 px 范围内，推荐默认控制在 Y≈500–540 px。

注意：1300–1470 px 指的是整个食品视觉组合从最高点到底部形成的整体视觉高度，不要求某一个单独食品本体达到这个高度。

食品必须具有“大主体感”，不能缩成一个小物体孤立地放在画面底部。

如果食品本身较矮，应通过以下方式增加纵向视觉体量：
- 超近景放大
- 多个同类食品自然堆叠
- 前后层次组合
- 局部裁切
- 主体超出左右边缘
- 主体超出底部边缘
- 强化局部切面、果肉、奶油、纹理等细节

不要采用“小物体 + 大量空白”的构图。

画面上部必须保持干净留白，用于后期叠加品牌 Logo、主标题和副标题。

Y=0–450 px 区域不得出现明显食品主体、装饰物、餐具、人物或复杂背景。

Y=450–620 px 可以出现食品视觉的少量顶部边缘，但不能形成主要视觉焦点。

【摄影风格】

premium commercial food photography,
editorial food photography,
macro food photography,
extreme close-up,
oversized hero food,
studio photography,
high-key photography,
soft diffused studio lighting,
large softbox lighting,
natural highlights,
subtle realistic shadows,
shallow depth of field where appropriate,
highly detailed realistic food texture,
fresh,
premium,
modern,
minimal,
clean,
airy,
appetizing.

食品必须呈现真实、自然、有食欲的质感。

根据食品自身特性自然表现：
水珠、凝露、果肉、果汁、纤维、奶油、糖粉、酥脆表皮、蛋糕气孔、冰晶、液体透光、奶泡、天然裂纹等真实细节。

食品允许存在适度天然瑕疵，不要过度完美。

避免塑料感、树脂感、CGI 感、3D 渲染感。

【背景要求】

背景固定使用纯白、暖白或极浅中性色。

背景必须极简、干净、几乎无场景信息。

不要出现：
厨房、餐厅、咖啡厅、木桌、大理石桌、房间、窗户、户外、野餐场景或复杂布景。

除非主题明确需要，否则不要加入盘子、刀叉、杯垫、花朵、叶子、包装、装饰物等辅助道具。

食品本身就是画面的主要设计元素。

【视觉原则】

大主体
近距离
强纹理
高真实度
高食欲感
极简
干净
高级
有呼吸感

优先追求视觉冲击力，而不是完整展示食品。

允许食品从左右及底部自然裁切。

不要平均排列多个食品，不要做电商陈列式构图。

如果存在多个食品，选择视觉识别度最高、纹理最丰富、最适合作为 Hero Food 的食品作为主要主体，其他食品只能作为少量陪衬。

【禁止】

no text
no typography
no Chinese characters
no English words
no logo
no brand mark
no watermark
no QR code
no border
no promotional badge
no poster graphic
no graphic decoration
no people
no hands
no cutlery
no busy props
no restaurant
no kitchen
no complicated background
no floating random objects
no duplicated malformed food
no distorted food
no plastic texture
no CGI
no 3D render
no cartoon
no illustration

最终只生成“纯食品主视觉底图”，不要生成完整海报，不要生成任何文字、Logo 或版式元素。
