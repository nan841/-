import { UserData, HistoryItem, AllowedUser } from '../types';
import { BASE_URL } from './geminiService';

const CURRENT_USER_SESSION = 'fastmoss_session';

export const syncToBackend = async (user: UserData) => {
  if (!user || !user.username) return;
  try {
    const res = await fetch(`${BASE_URL}/sync-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, history: user.history })
    });
    if (res.ok) {
       console.log(`✅ 账号 [${user.username}] 的历史记录已成功钉入服务器硬盘！`);
    }
  } catch (e) {
    console.error("同步历史记录失败:", e);
  }
};

export const getCurrentUser = (): UserData | null => {
  try {
    const sessionStr = sessionStorage.getItem(CURRENT_USER_SESSION);
    if (!sessionStr) return null;
    const session = JSON.parse(sessionStr);
    
    const historyStr = localStorage.getItem(`fastmoss_history_${session.username}`);
    return {
      username: session.username,
      lastActiveId: session.lastActiveId,
      history: historyStr ? JSON.parse(historyStr) : []
    };
  } catch { return null; }
};

export const setCurrentUser = (user: UserData | null) => {
  if (user) {
    sessionStorage.setItem(CURRENT_USER_SESSION, JSON.stringify({
      username: user.username,
      lastActiveId: user.lastActiveId
    }));
    localStorage.setItem(`fastmoss_history_${user.username}`, JSON.stringify(user.history));
  } else {
    sessionStorage.removeItem(CURRENT_USER_SESSION);
  }
};

export const logoutUser = () => {
  setCurrentUser(null);
};

export const updateHistoryItem = (item: HistoryItem) => {
  const user = getCurrentUser();
  if (!user) return;
  const existingIdx = user.history.findIndex(h => h.id === item.id);
  if (existingIdx >= 0) {
    user.history[existingIdx] = item;
  } else {
    user.history.unshift(item);
  }
  user.lastActiveId = item.id;
  setCurrentUser(user);
  syncToBackend(user); 
};

export const moveToTrash = (id: string) => {
  const user = getCurrentUser();
  if (!user) return;
  const item = user.history.find(h => h.id === id);
  if (item) {
    item.deletedAt = Date.now();
    setCurrentUser(user);
    syncToBackend(user);
  }
};

export const restoreFromTrash = (id: string) => {
  const user = getCurrentUser();
  if (!user) return;
  const item = user.history.find(h => h.id === id);
  if (item) {
    item.deletedAt = undefined;
    setCurrentUser(user);
    syncToBackend(user);
  }
};

export const permanentDelete = (id: string) => {
  const user = getCurrentUser();
  if (!user) return;
  user.history = user.history.filter(h => h.id !== id);
  setCurrentUser(user);
  syncToBackend(user);
};

// ✅ 新增：一键清空回收站逻辑，剔除掉本地被删的内容
export const emptyTrash = () => {
  const user = getCurrentUser();
  if (!user) return;
  user.history = user.history.filter(h => !h.deletedAt);
  setCurrentUser(user);
  syncToBackend(user);
};

export const getAllowedUsers = (): AllowedUser[] => {
  try { return JSON.parse(localStorage.getItem('fastmoss_allowed_users_v2') || '[]'); } 
  catch { return []; }
};

export const saveAllowedUsers = (users: AllowedUser[]) => {
  localStorage.setItem('fastmoss_allowed_users_v2', JSON.stringify(users));
};
