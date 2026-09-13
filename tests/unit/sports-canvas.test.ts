import { describe,it,expect } from "vitest";
import { sportsCanvases,sportsRequestSize,sportsCanvasPrompt } from "@/contracts/sports-canvas";
import { briefFromConfirmedDescription } from "@/providers/prompt-compiler";
import { imageRequestPrompt } from "@/providers/illustration-provider";
describe("designer coordinate contract",()=>{
 for(const target of Object.keys(sportsCanvases) as Array<keyof typeof sportsCanvases>){
  it(target,()=>{
   const c=sportsCanvases[target],native=sportsRequestSize(target);
   expect(native.width%16).toBe(0); expect(native.height%16).toBe(0);
   expect(native.width-c.width).toBeLessThan(16);expect(native.height-c.height).toBeLessThan(16);
   expect(native.width).toBeGreaterThanOrEqual(c.width);expect(native.height).toBeGreaterThanOrEqual(c.height);
   const brief=briefFromConfirmedDescription("篮球入网的真实运动瞬间，蓝色背景，克制光影。",{category:"competition",themeKeywords:[],visualIntent:"篮球",peopleMode:"forbid"});
   const prompt=imageRequestPrompt({...brief,canvasTarget:target});
   expect(prompt).toContain(sportsCanvasPrompt(target));
   expect(prompt).not.toMatch(/68%|78%|48%|58%|向右侧或下方延展|936×780/);
   if(target!=="portrait_1080x1920") expect(prompt).not.toContain("Y=1290–1920px");
   expect(prompt).toContain("禁止人物、人体");
   expect(prompt).toContain("出血边");
  });
 }
});
