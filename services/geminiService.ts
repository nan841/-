
import { GoogleGenAI, Type } from "@google/genai";
import { ProductInfo } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeProductWithSearch = async (pid: string): Promise<ProductInfo | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `分析 FastMoss PID 为 ${pid} 的电商产品信息。请提取产品的名称、品牌、国家、详细类目和预估价格。`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pid: { type: Type.STRING },
            introduction: { type: Type.STRING },
            brand: { type: Type.STRING },
            country: { type: Type.STRING },
            category: { type: Type.STRING },
            price: { type: Type.STRING },
            images: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "提取到的高质量产品图片链接" 
            },
          },
          required: ["pid", "introduction", "brand", "country", "category", "price", "images"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Scraping error:", error);
    return null;
  }
};

export const generateThreeView = async (product: ProductInfo) => {
  const prompt = `生成产品的白底三视图。产品描述: ${product.introduction}。布局结构: 图像包含三个独立视图(前、后、侧)，平行排列。超写实摄影风格，摄影棚光影。`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};

export const generateInteraction = async (product: ProductInfo, modelImageBase64?: string, customPrompt?: string) => {
  const basePrompt = `让模特自然穿戴该产品: ${product.introduction}。9:16竖屏快照，生活化场景。`;
  const finalPrompt = customPrompt ? `${customPrompt} (参考产品: ${product.introduction})` : basePrompt;
  
  const parts: any[] = [{ text: finalPrompt }];
  if (modelImageBase64) {
    parts.push({ inlineData: { data: modelImageBase64.split(',')[1], mimeType: 'image/jpeg' } });
  }
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { imageConfig: { aspectRatio: "9:16" } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};

export const generateSellingPoints = async (product: ProductInfo) => {
  const prompt = `分析产品：${product.introduction}，生成5个核心卖点。要求：每行一个，简洁有力，突出转化。`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  });
  return JSON.parse(response.text);
};

export const generateScript = async (product: ProductInfo, points: string[], customPrompt?: string) => {
  const basePrompt = `基于产品 ${product.introduction} 和卖点 ${points.join('; ')} 生成一段TikTok带货脚本。要求包含Hook、核心内容和CTA。`;
  const finalPrompt = customPrompt ? `${basePrompt} 额外要求：${customPrompt}` : basePrompt;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: finalPrompt,
  });
  return response.text;
};
