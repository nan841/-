import { UserData, HistoryItem, AllowedUser } from "../types";

const STORAGE_KEY = 'fastmoss_ai_users_v2';
const CURRENT_USER_KEY = 'fastmoss_ai_current_user_v2';
const ALLOWED_USERS_KEY = 'fastmoss_ai_allowed_list_v2';
const TRASH_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000; 

// 后端地址
const API_BASE = "http://localhost:8000"; 

// 👇 同步到 Python 后端
const syncToBackend = (user: UserData) => {
  fetch(`${API_BASE}/api/sync-history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.username, history: user.history })
  }).catch(err => console.warn("同步历史记录失败(后端可能未启动):", err));
};

export const getAllowedUsers = (): AllowedUser[] => {
  const list = localStorage.getItem(ALLOWED_USERS_KEY);
  return list ? JSON.parse(list) : [];
};

export const saveAllowedUsers = (list: AllowedUser[]) => {
  localStorage.setItem(ALLOWED_USERS_KEY, JSON.stringify(list));
};

export const getAllUsers = (): Record<string, UserData> => {
  const users = localStorage.getItem(STORAGE_KEY);
  return users ? JSON.parse(users) : {};
};

// 👇 必须放在 saveUserToGlobal 前面
const saveUserToGlobal = (user: UserData) => {
  const users = getAllUsers();
  users[user.username] = user;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  
  // 🔥 每次保存时触发同步
  syncToBackend(user);
};

const cleanOldTrash = (user: UserData): UserData => {
  const now = Date.now();
  const initialCount = user.history.length;
  user.history = user.history.filter(item => {
    if (item.deletedAt) {
      return (now - item.deletedAt) < TRASH_EXPIRY_MS;
    }
    return true;
  });
  
  if (user.history.length !== initialCount) {
    saveUserToGlobal(user);
  }
  return user;
};

export const getCurrentUser = (): UserData | null => {
  const user = localStorage.getItem(CURRENT_USER_KEY);
  if (!user) return null;
  const userData: UserData = JSON.parse(user);
  return cleanOldTrash(userData);
};

export const loginUser = (username: string, password: string): UserData | null => {
  const users = getAllUsers();
  if (!users[username]) {
    users[username] = { username, history: [] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }
  const user = cleanOldTrash(users[username]);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const updateHistoryItem = (item: HistoryItem) => {
  const user = getCurrentUser();
  if (!user) return;
  const index = user.history.findIndex(h => h.id === item.id);
  if (index > -1) {
    user.history[index] = item;
  } else {
    user.history.unshift(item);
  }
  user.lastActiveId = item.id;
  saveUserToGlobal(user);
};

export const moveToTrash = (id: string) => {
  const user = getCurrentUser();
  if (!user) return;
  const item = user.history.find(h => h.id === id);
  if (item) {
    item.deletedAt = Date.now();
    saveUserToGlobal(user);
  }
};

export const restoreFromTrash = (id: string) => {
  const user = getCurrentUser();
  if (!user) return;
  const item = user.history.find(h => h.id === id);
  if (item) {
    delete item.deletedAt;
    saveUserToGlobal(user);
  }
};

export const permanentDelete = (id: string) => {
  const user = getCurrentUser();
  if (!user) return;
  user.history = user.history.filter(h => h.id !== id);
  if (user.lastActiveId === id) delete user.lastActiveId;
  saveUserToGlobal(user);
};
