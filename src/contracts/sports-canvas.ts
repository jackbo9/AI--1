import type { RenderTargetId } from "./brand";

export const sportsCanvasVersion = "sports-canvas-v1";
export const sportsCanvases = {
  portrait_1080x1920: { width:1080, height:1920, focus:[378,443,1080,1280], title:[0,0,1080,443], secondary:[650,0,1080,443], backgroundFrom:1290 },
  landscape_1920x1080: { width:1920, height:1080, focus:[770,0,1920,746], title:[0,0,770,746], backgroundFrom:746 },
  banner_2227x950: { width:2227, height:950, focus:[950,0,2227,950], title:[0,0,950,950], backgroundFrom:950 },
  longform_1080xAuto: { width:1080, height:3000, focus:[378,443,1080,1210], title:[0,0,1080,443], secondary:[650,0,1080,443], backgroundFrom:1210 }
} as const;

export function sportsCanvasPrompt(target: RenderTargetId) {
  const c = sportsCanvases[target];
  const box = (r: readonly number[]) => `X=${r[0]}–${r[2]}px,Y=${r[1]}–${r[3]}px`;
  return [
    `P0最高优先级，覆盖创意描述中的冲突构图。完整画布 ${c.width}×${c.height}px。不是局部裁切图、透明主体或完整海报。`,
    `Primary Visual Focus、主要器材、关键动作、人物主要局部、最强高光/对比/轨迹必须主要位于 ${box(c.focus)}。主视觉整体偏右，不居中、不对称平分，不把所有元素硬塞进矩形。`,
    `同一核心区域的归一化范围：横向 ${(c.focus[0]/c.width*100).toFixed(1)}%–${(c.focus[2]/c.width*100).toFixed(1)}%，纵向 ${(c.focus[1]/c.height*100).toFixed(1)}%–${(c.focus[3]/c.height*100).toFixed(1)}%。这里按整张完整画布计算，不按局部窗口计算。`,
    target === "longform_1080xAuto" ? "长图不是把主体放在整张图中央：主体与关键动作的完整视觉事件只占上部约三分之一，画布下方60%必须完全没有器材；避免镜头把主要器材或人物放在画布中段。" : "",
    `标题安全区 ${box(c.title)} 低信息、低对比，不出现第二强焦点。`,
    "secondary" in c ? `顶部仅 ${box(c.secondary)} 可有少量次要元素，不抢标题。` : "",
    c.backgroundFrom < c.height ? `底部 X=0–${c.width}px,Y=${c.backgroundFrom}–${c.height}px 强制仅背景；禁止球、球拍、人体、关键动作、强轨迹、高光、强对比和新焦点，只允许场地、地面、墙面、环境色、柔和线条、阴影和低对比纹理。` : "左侧仅低信息背景，运动可从右向画面内部延伸。",
    c.backgroundFrom < c.height ? `所有关键主体必须在 Y=${c.focus[3]}px 之前完整结束；球体、网袋底部、人体主要局部至少距离核心区下沿60px，不可被信息区遮断。底部不出现明显光斑、镜面强反射或高亮地面线条。` : "",
    "顶部标题区不出现明亮灯具、聚光或强窗光。有效区之外仍须完整自然连续背景。次要延伸如拍杆、球网、场地线、人体边缘可少量越出核心区，但不能形成新焦点，不能进入底部强制背景区。"
  ].filter(Boolean).join("\n");
}
export function sportsRequestSize(target: RenderTargetId) {
  const c = sportsCanvases[target];
  return { width: Math.ceil(c.width / 16) * 16, height: Math.ceil(c.height / 16) * 16 };
}
