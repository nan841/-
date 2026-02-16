import { UserData, HistoryItem, AllowedUser } from '../types';

const CURRENT_USER_SESSION = 'fastmoss_session';
const BASE_URL = 'http://192.168.20.216:8000/api';

const syncToBackend = async (user: UserData) => {
  if (!user || !user.username) return;
  try {
    await fetch(`${BASE_URL}/sync-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, history: user.history })
    });
  } catch (e) {
    console.error("同步历史记录失败:", e);
  }
};

export const getCurrentUser = (): UserData | null => {
  try {
    // Session 控制当前网页是哪个账号登录的
    const sessionStr = sessionStorage.getItem(CURRENT_USER_SESSION);
    if (!sessionStr) return null;
    const session = JSON.parse(sessionStr);
    
    // ✅ 绝对隔离：只读取专门挂在这个账号名下的记录保险箱！
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
    // 数据死死钉在这个账号的名下
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

export const getAllowedUsers = (): AllowedUser[] => {
  try { return JSON.parse(localStorage.getItem('fastmoss_allowed_users_v2') || '[]'); } 
  catch { return []; }
};

export const saveAllowedUsers = (users: AllowedUser[]) => {
  localStorage.setItem('fastmoss_allowed_users_v2', JSON.stringify(users));
};
