import { getCurrentUser } from './storageService';

export const BASE_URL = `http://${window.location.hostname}:8000/api`;

const getUsername = () => {
  const user = getCurrentUser();
  return user ? user.username : 'unknown';
};

export const loginUser = async (username: string, password: string) => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!response.ok || data.detail) throw new Error(data.detail || "登录失败");
  return data;
};

export const adminGetConfig = async (adminPass: string) => {
  const response = await fetch(`${BASE_URL}/admin/get-config`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_pass: adminPass })
  });
  if (!response.ok) return { text_model: "gpt-5.2" };
  const data = await response.json();
  return data;
};

export const adminSetConfig = async (adminPass: string, text_model: string) => {
  const response = await fetch(`${BASE_URL}/admin/set-config`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_pass: adminPass, text_model })
  });
  const data = await response.json();
  if (!response.ok || data.detail) throw new Error(data.detail || "切换模型失败");
  return data;
};

// ✅ 新增：管理员发包测试模型接口
export const adminTestModel = async (adminPass: string, text_model: string) => {
  const response = await fetch(`${BASE_URL}/admin/test-model`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_pass: adminPass, text_model })
  });
  const data = await response.json();
  if (!response.ok || data.detail) throw new Error(data.detail || "测试请求失败");
  return data;
};

export const adminAddUser = async (adminPass: string, newU: string, newP: string) => {
  const response = await fetch(`${BASE_URL}/admin/add-user`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_pass: adminPass, new_username: newU, new_password: newP })
  });
  const data = await response.json();
  if (!response.ok || data.detail) throw new Error(data.detail || "添加失败");
  return data;
};

export const adminGetUsers = async (adminPass: string) => {
  const response = await fetch(`${BASE_URL}/admin/users`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_pass: adminPass })
  });
  const data = await response.json();
  if (!response.ok || data.detail) throw new Error(data.detail || "获取失败");
  return data.users;
};

export const adminDeleteUser = async (adminPass: string, targetU: string) => {
  const response = await fetch(`${BASE_URL}/admin/delete-user`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_pass: adminPass, username: targetU })
  });
  const data = await response.json();
  if (!response.ok || data.detail) throw new Error(data.detail || "删除失败");
  return data;
};

export const deleteBackendProduct = async (pid: string, username: string) => {
  try {
    await fetch(`${BASE_URL}/delete`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid, username })
    });
  } catch (e) {}
};

export const deleteBackendImage = async (url: string) => {
  try {
    await fetch(`${BASE_URL}/delete-image`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url, username: getUsername() })
    });
  } catch (e) { console.error("物理删除失败", e); }
};

export const analyzeProductWithSearch = async (pid: string, username?: string) => {
  const response = await fetch(`${BASE_URL}/analyze`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pid, username: username || getUsername() })
  });
  const data = await response.json();
  if (!response.ok || data.detail) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail) || "采集失败");
  return data;
};

export const generateThreeView = async (product: any, username: string) => {
  try {
    const response = await fetch(`${BASE_URL}/gen-3view`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid: product.pid, username, product, images: product.images || [] })
    });
    const data = await response.json();
    if (!response.ok || data.detail) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail) || "生成三视图失败");
    return data.result;
  } catch (error: any) { alert(`❌ 失败: ${error.message}`); return null; }
};

export const generateInteraction = async (product: any, username: string, modelImage?: string | null, customPrompt?: string) => {
  try {
    const response = await fetch(`${BASE_URL}/gen-interaction`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        pid: product.pid, username, product, images: product.images || [], 
        custom_prompt: customPrompt || null, 
        model_image_b64: modelImage || null 
      })
    });
    const data = await response.json();
    if (!response.ok || data.detail) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail) || "生成模特图失败");
    return data.result;
  } catch (error: any) { alert(`❌ 失败: ${error.message}`); return null; }
};

export const generateSellingPoints = async (product: any, username: string) => {
  try {
    const response = await fetch(`${BASE_URL}/gen-points`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid: product.pid, username, product, images: product.images || [] })
    });
    const data = await response.json();
    if (!response.ok || data.detail) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail) || "卖点分析失败");
    return data.result;
  } catch (error: any) { alert(`❌ 失败: ${error.message}`); return null; }
};

export const generateScript = async (product: any, username: string, points: string[], customPrompt?: string, generatedAssets?: string[]) => {
  try {
    const response = await fetch(`${BASE_URL}/gen-script`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        pid: product.pid, username, product, images: product.images || [], 
        points, custom_prompt: customPrompt || null, 
        generated_assets: generatedAssets || [] 
      })
    });
    const data = await response.json();
    if (!response.ok || data.detail) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail) || "脚本生成失败");
    return data.result;
  } catch (error: any) { alert(`❌ 失败: ${error.message}`); return null; }
};
