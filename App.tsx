import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Layers, User, Zap, FileText, MessageSquare, Loader2, 
  Image as ImageIcon, LogOut, UserCircle, Sparkles, History, Trash2, RotateCcw, 
  XCircle, Clock, ShieldCheck, UserPlus, Key, CheckCircle, Circle, ZoomIn, Settings, PlusCircle
} from 'lucide-react';
import { AppTab, UserData, HistoryItem, AllowedUser } from './types';
import * as gemini from './services/geminiService';
import * as storage from './services/storageService';

const ensureArray = (val: any): string[] => Array.isArray(val) ? val : (val ? [val] : []);

const formatImgUrl = (url: string | undefined | null) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url; 
  const host = window.location.hostname;
  if (url.startsWith('/images/')) return `http://${host}:8000${url}`;
  return url.replace(/^http:\/\/[a-zA-Z0-9\.-]+:\d+/i, `http://${host}:8000`);
};

const MODEL_OPTIONS = [
  "gpt-5.2",
  "gpt-5.2-chat-latest",
  "claude-opus-4-6",
  "gemini-3-pro-preview",
  "gpt-5.3-codex"
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [iconClicks, setIconClicks] = useState(0);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoggedInAsAdmin, setIsLoggedInAsAdmin] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');

  const [sysTextModel, setSysTextModel] = useState('gpt-5.2');
  const [customModelInput, setCustomModelInput] = useState('');
  
  // ✅ 新增：模型测试沙箱状态
  const [testModelInput, setTestModelInput] = useState('');
  const [testModelResult, setTestModelResult] = useState('');

  const [pid, setPid] = useState('');
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const setLoading = (key: string, isLoading: boolean) => setLoadingStates(prev => ({ ...prev, [key]: isLoading }));

  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.ProductInfo);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'default' | 'custom'>('default');
  const [customInteractionPrompt, setCustomInteractionPrompt] = useState('');
  const [scriptMode, setScriptMode] = useState<'default' | 'custom'>('default');
  const [customScriptPrompt, setCustomScriptPrompt] = useState('');

  const [customPointInput, setCustomPointInput] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => { setSelectedAssets([]); }, [activeItemId]);

  const activeItem = useMemo(() => {
    let item = currentUser?.history.find(h => h.id === activeItemId && !h.deletedAt);
    if (item) {
      const migrated = { ...item };
      if (!migrated.threeViews) migrated.threeViews = [];
      if (!migrated.interactions) migrated.interactions = [];
      if (!migrated.sellingPoints) migrated.sellingPoints = [];
      if (!migrated.customPoints) migrated.customPoints = [];
      if (!migrated.selectedPoints) migrated.selectedPoints = [...migrated.sellingPoints];
      return migrated;
    }
    return null;
  }, [currentUser, activeItemId]);

  const historyList = useMemo(() => currentUser?.history.filter(h => !h.deletedAt).sort((a,b) => b.timestamp - a.timestamp) || [], [currentUser]);
  const trashList = useMemo(() => currentUser?.history.filter(h => !!h.deletedAt).sort((a,b) => b.deletedAt! - a.deletedAt!) || [], [currentUser]);

  useEffect(() => {
    const user = storage.getCurrentUser();
    if (user) { setCurrentUser(user); if (user.lastActiveId) setActiveItemId(user.lastActiveId); }
  }, []);

  const refreshUser = () => setCurrentUser(storage.getCurrentUser());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginError('');
    if (!loginInput.trim() || !passwordInput.trim()) return;
    setLoading('login', true);
    try {
      const res = await gemini.loginUser(loginInput.trim(), passwordInput.trim());
      
      let finalHistory = res.user.history || [];
      const localHistoryStr = localStorage.getItem(`fastmoss_history_${res.user.username}`);
      if (finalHistory.length === 0 && localHistoryStr) {
          const localHistory = JSON.parse(localHistoryStr);
          if (localHistory.length > 0) {
              finalHistory = localHistory;
              storage.syncToBackend({ username: res.user.username, history: finalHistory });
          }
      }

      const loggedInUser: UserData = { username: res.user.username, lastActiveId: finalHistory?.[0]?.id || null, history: finalHistory };
      storage.setCurrentUser(loggedInUser); setCurrentUser(loggedInUser);
    } catch (error: any) { setLoginError(error.message); } finally { setLoading('login', false); }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === '秦涛' && adminPassword === 'qt20030802') {
      try { 
        setAllowedUsers(await gemini.adminGetUsers(adminPassword)); 
        const conf = await gemini.adminGetConfig(adminPassword);
        if(conf.text_model) setSysTextModel(conf.text_model);
        setIsLoggedInAsAdmin(true); 
      } 
      catch (error: any) { alert("进入后台失败: " + error.message); }
    } else { alert('管理员身份或密码错误'); }
  };

  const handleUpdateSystemModel = async (modelName: string) => {
    if (!modelName.trim()) return;
    setLoading('updateModel', true);
    try {
      await gemini.adminSetConfig(adminPassword, modelName.trim());
      setSysTextModel(modelName.trim());
      setCustomModelInput('');
      alert(`✅ 已成功将全局大模型切换为：${modelName.trim()}\n全员端已立即生效！`);
    } catch(e:any) { alert(e.message); } finally { setLoading('updateModel', false); }
  };

  // ✅ 新增：请求测试模型连通性
  const handleTestModel = async (modelName: string) => {
    if (!modelName.trim()) return;
    setLoading('testModel', true);
    setTestModelResult('');
    try {
      const res = await gemini.adminTestModel(adminPassword, modelName.trim());
      setTestModelResult(`✅ 测试成功！模型回复:\n\n${res.result}`);
    } catch(e:any) {
      setTestModelResult(`❌ 测试失败！API 报错:\n\n${e.message}`);
    } finally {
      setLoading('testModel', false);
    }
  };

  // ✅ 新增：一键彻底清空回收站及物理源文件
  const handleEmptyTrash = async () => {
    if (!currentUser || trashList.length === 0) return;
    if (!window.confirm("⚠️ 警告：确定要一键清空回收站吗？所有文件将被永久物理删除且无法恢复！")) return;
    
    setLoading('emptyTrash', true);
    try {
      await Promise.all(trashList.map(item => gemini.deleteBackendProduct(item.product.pid, currentUser.username)));
      storage.emptyTrash();
      refreshUser();
    } catch (error: any) {
      alert("清空失败: " + error.message);
    } finally {
      setLoading('emptyTrash', false);
    }
  };

  const handleIconClick = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault(); 
    setIconClicks(prev => prev + 1); 
  };

  useEffect(() => {
    if (iconClicks >= 7) {
      setIsAdminMode(true);
      setIconClicks(0); 
    }
    if (iconClicks > 0) {
      const timer = setTimeout(() => setIconClicks(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [iconClicks]);

  const handleAddAllowedUser = async () => {
    if (!newUserName.trim() || !newUserPass.trim()) return; setLoading('adminAdd', true);
    try {
      await gemini.adminAddUser(adminPassword, newUserName.trim(), newUserPass.trim());
      setAllowedUsers(await gemini.adminGetUsers(adminPassword)); setNewUserName(''); setNewUserPass('');
      alert("授权成功！");
    } catch (error: any) { alert(error.message); } finally { setLoading('adminAdd', false); }
  };

  const handleDeleteAllowedUser = async (username: string) => {
    if (!window.confirm(`确定要彻底收回员工 [${username}] 的系统访问权限吗？`)) return;
    try { await gemini.adminDeleteUser(adminPassword, username); setAllowedUsers(await gemini.adminGetUsers(adminPassword)); alert(`已成功撤销权限！`); } 
    catch (error: any) { alert(`删除失败: ${error.message}`); }
  };

  const handleLogout = () => { storage.logoutUser(); setCurrentUser(null); setActiveItemId(null); setIsLoggedInAsAdmin(false); setIsAdminMode(false); setIconClicks(0); setTestModelResult(''); };

  const handleFetchProduct = async () => {
    if (!pid || !currentUser) return; setLoading('fetch', true);
    try {
      const info: any = await gemini.analyzeProductWithSearch(pid, currentUser.username);
      if (!info || info.detail) { alert(info?.detail || "采集失败"); return; }
      const newItem: HistoryItem = { id: `${Date.now()}-${pid}`, timestamp: Date.now(), product: info };
      storage.updateHistoryItem(newItem); setActiveItemId(newItem.id); setActiveTab(AppTab.ProductInfo); refreshUser();
    } catch (error: any) { alert(error.message); } finally { setLoading('fetch', false); }
  };

  const handleUpdateCurrentItem = (updates: Partial<HistoryItem>) => {
    if (!activeItem) return;
    storage.updateHistoryItem({ ...activeItem, ...updates }); refreshUser();
  };

  const toggleSelectAsset = (url: string) => {
    setSelectedAssets(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);
  };

  const handleDeleteAsset = async (type: 'threeViews' | 'interactions', url: string) => {
    if(!window.confirm("确定永久删除此图吗？物理原文件也会被销毁！")) return;
    await gemini.deleteBackendImage(url);
    const currentList = ensureArray(activeItem?.[type]);
    handleUpdateCurrentItem({ [type]: currentList.filter(u => u !== url) });
    setSelectedAssets(prev => prev.filter(u => u !== url));
  };

  const handleGenThreeView = async () => {
    if (!activeItem || !currentUser) return; setLoading('threeView', true);
    try {
      const res = await gemini.generateThreeView(activeItem.product, currentUser.username);
      if (res) {
        handleUpdateCurrentItem({ threeViews: [res, ...(activeItem.threeViews || [])] });
        setSelectedAssets(prev => [...prev, res]); 
      }
    } finally { setLoading('threeView', false); }
  };

  const handleGenInteraction = async () => {
    if (!activeItem || !currentUser) return; setLoading('interaction', true);
    try {
      const res = await gemini.generateInteraction(activeItem.product, currentUser.username, modelImage || undefined, interactionMode === 'custom' ? customInteractionPrompt : undefined);
      if (res) {
        handleUpdateCurrentItem({ interactions: [res, ...(activeItem.interactions || [])] });
        setSelectedAssets(prev => [...prev, res]); 
      }
    } finally { setLoading('interaction', false); }
  };

  const togglePointSelection = (point: string) => {
    if (!activeItem) return;
    const selected = activeItem.selectedPoints || [];
    const newSelected = selected.includes(point) ? selected.filter(p => p !== point) : [...selected, point];
    handleUpdateCurrentItem({ selectedPoints: newSelected });
  };

  const handleAddCustomPoint = () => {
    if (!customPointInput.trim() || !activeItem) return;
    const val = customPointInput.trim();
    const newCustoms = [...(activeItem.customPoints || []), val];
    const newSelected = [...(activeItem.selectedPoints || []), val]; 
    handleUpdateCurrentItem({ customPoints: newCustoms, selectedPoints: newSelected });
    setCustomPointInput('');
  };

  const handleDeleteCustomPoint = (point: string) => {
    if (!activeItem) return;
    const newCustoms = (activeItem.customPoints || []).filter(p => p !== point);
    const newSelected = (activeItem.selectedPoints || []).filter(p => p !== point);
    handleUpdateCurrentItem({ customPoints: newCustoms, selectedPoints: newSelected });
  };

  const handleGenSellingPoints = async () => {
    if (!activeItem || !currentUser) return; setLoading('points', true);
    try {
      const res = await gemini.generateSellingPoints(activeItem.product, currentUser.username);
      if (res) {
        const oldSelected = activeItem.selectedPoints || [];
        const newSelected = Array.from(new Set([...oldSelected, ...res])); 
        handleUpdateCurrentItem({ sellingPoints: res, selectedPoints: newSelected });
      }
    } finally { setLoading('points', false); }
  };

  const handleGenScript = async () => {
    if (!activeItem || !currentUser) return; setLoading('script', true);
    try {
      const pointsToFeed = activeItem.selectedPoints || [];
      const res = await gemini.generateScript(activeItem.product, currentUser.username, pointsToFeed, scriptMode === 'custom' ? customScriptPrompt : undefined, selectedAssets);
      if (res) handleUpdateCurrentItem({ script: res });
    } finally { setLoading('script', false); }
  };

  const renderGalleryWithPreview = (images: string[] | undefined, type: 'threeViews' | 'interactions') => {
    const list = images || [];
    if (list.length === 0) return null;
    const previewImg = formatImgUrl(list[0]);

    return (
      <div className="w-full mt-10 pt-10 border-t border-slate-100 animate-in fade-in space-y-8">
        <div className="w-full flex flex-col items-center">
          <p className="text-[10px] text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full mb-6 border border-indigo-100 uppercase tracking-widest shadow-sm">✨ 最新出炉的画卷</p>
          <div className="w-full max-w-[280px] md:max-w-md mx-auto rounded-[40px] overflow-hidden border-8 border-slate-50 shadow-2xl relative cursor-zoom-in group" onClick={() => setPreviewImage(previewImg)}>
            <img src={previewImg} className="w-full h-auto object-contain max-h-[600px] bg-white group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
               <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" size={48} />
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2"><ImageIcon size={16}/> 历史相册 ({list.length})</h4>
            <p className="text-[10px] text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-indigo-100">☑️ 请打勾选中你想让 AI 参考的图片</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {list.map((img, idx) => {
              const fixedImg = formatImgUrl(img);
              const isSelected = selectedAssets.includes(img);
              return (
                <div key={idx} className={`relative group rounded-3xl overflow-hidden border-4 aspect-[3/4] bg-white transition-all ${isSelected ? 'border-indigo-500 shadow-xl scale-105' : 'border-slate-50 hover:border-slate-200 shadow-sm'}`}>
                  <img src={fixedImg} className="w-full h-full object-cover cursor-zoom-in group-hover:scale-110 transition-transform duration-500" onClick={() => setPreviewImage(fixedImg)} />
                  <button onClick={(e) => { e.stopPropagation(); toggleSelectAsset(img); }} className="absolute top-4 left-4 p-1 rounded-full bg-white/95 shadow hover:scale-110 transition-transform z-10" title="选中给大模型做剧本参考">
                     {isSelected ? <CheckCircle className="text-indigo-600" size={28}/> : <Circle className="text-slate-300" size={28}/>}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setPreviewImage(fixedImg); }} className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 z-10 backdrop-blur-sm shadow-xl"><ZoomIn size={24} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteAsset(type, img); }} className="absolute top-4 right-4 bg-red-500/90 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:scale-110 shadow-lg z-10" title="彻底物理粉碎这张图片"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (isLoggedInAsAdmin) {
    return (
      <div className="flex h-screen bg-[#f8fafc] font-['Noto_Sans_SC']">
        <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col p-6 space-y-8 z-10 shadow-xl">
          <div className="flex items-center space-x-3 mb-2"><div className="bg-white text-slate-900 p-1.5 rounded-lg"><ShieldCheck size={18} /></div><h1 className="text-lg font-black tracking-tight text-white">控制中枢</h1></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3">系统管理员：秦涛</p>
          <div className="mt-auto pt-4"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-white/10 rounded-xl text-xs font-bold text-white hover:bg-red-500 transition-all"><LogOut size={14} /> 退出控制台</button></div>
        </aside>
        <main className="flex-1 overflow-y-auto p-10 bg-slate-50">
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2"><h3 className="text-3xl font-black text-slate-900">核心配置</h3></div>
            <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4 text-slate-800 font-black border-b border-slate-100 pb-4"><Settings size={24} className="text-indigo-600"/> 全局大语言模型热切换</div>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">在此配置的 AI 将负责全公司的「核心卖点提炼」与「营销短视频剧本生成」。一经保存全员立刻生效。</p>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                   <div className="w-1/3">
                     <select value={sysTextModel} onChange={e => {
                         setSysTextModel(e.target.value);
                         setTestModelResult('');
                     }} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                        {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                     </select>
                   </div>
                   <span className="text-xs font-bold text-slate-400">或手动录入：</span>
                   <div className="flex-1 flex gap-2">
                     <input type="text" placeholder="自定义第三方 API 模型名称..." value={customModelInput} onChange={e => {
                         setCustomModelInput(e.target.value);
                         setTestModelResult('');
                     }} onKeyDown={e => e.key === 'Enter' && handleUpdateSystemModel(customModelInput)} className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                     <button onClick={() => handleUpdateSystemModel(customModelInput)} disabled={loadingStates['updateModel'] || !customModelInput.trim()} className="bg-indigo-600 text-white rounded-2xl py-3 px-6 text-sm font-black hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 shrink-0">
                        {loadingStates['updateModel'] ? <Loader2 size={16} className="animate-spin"/> : '强行覆盖部署'}
                     </button>
                   </div>
                </div>

                {/* ✅ 新增：模型连通性测试板块 */}
                <div className="flex items-center gap-4 border-t border-slate-100 pt-6 mt-2">
                   <span className="text-xs font-bold text-slate-400 block whitespace-nowrap">模型连通性测试 (测试成功后再切换)：</span>
                   <div className="flex-1 flex gap-2 items-center">
                     <input type="text" placeholder="输入要测试的模型名称 (如: gpt-3.5-turbo)..." value={testModelInput} onChange={e => setTestModelInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTestModel(testModelInput)} className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                     <button onClick={() => handleTestModel(testModelInput)} disabled={loadingStates['testModel'] || !testModelInput.trim()} className="bg-slate-900 text-white rounded-2xl py-3 px-6 text-sm font-black hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50 shrink-0">
                        {loadingStates['testModel'] ? <Loader2 size={16} className="animate-spin"/> : '发送测试请求'}
                     </button>
                   </div>
                </div>
                {testModelResult && (
                   <div className={`p-4 rounded-xl text-xs font-bold leading-relaxed break-all border ${testModelResult.includes('✅') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {testModelResult}
                   </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-10"><h3 className="text-3xl font-black text-slate-900">安全授权管理</h3><p className="text-slate-500 text-sm">分配账号，后端自动拦截非法登录者并物理隔离文件。</p></div>
            <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative"><UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="新员工用户名" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"/></div>
                <div className="flex-1 relative"><Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="设置登录密码" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"/></div>
                <button onClick={handleAddAllowedUser} disabled={loadingStates['adminAdd']} className="bg-slate-900 text-white rounded-2xl py-3 px-6 text-sm font-bold hover:bg-black transition-all flex items-center gap-2">{loadingStates['adminAdd'] ? <Loader2 className="animate-spin" size={16}/> : <UserPlus size={16} />} 添加授权</button>
              </div>
              <div className="pt-4 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">当前已授权用户 ({allowedUsers.length})</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allowedUsers.map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 font-black">{u.username[0]}</div><div><p className="text-sm font-black text-slate-900">{u.username}</p><p className="text-[10px] font-bold text-slate-400">Pass: {u.password}</p></div></div><button onClick={() => handleDeleteAllowedUser(u.username)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isAdminMode && !isLoggedInAsAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-['Noto_Sans_SC']">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-2xl relative animate-in fade-in text-center">
          <div className="bg-slate-100 w-16 h-16 rounded-3xl text-slate-900 shadow-2xl mb-8 mx-auto flex items-center justify-center"><ShieldCheck size={32} /></div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">超级管理员入口</h1>
          <form onSubmit={handleAdminLogin} className="space-y-4 text-left mt-8">
            <input type="text" placeholder="身份：秦涛" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none font-bold" />
            <input type="password" placeholder="验证密码" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none font-bold" />
            <button type="submit" className="w-full bg-white text-slate-900 rounded-2xl py-4 font-bold transition-all hover:bg-slate-100">验证进入控制台</button>
            <button type="button" onClick={() => setIsAdminMode(false)} className="w-full text-slate-500 text-xs font-bold py-2 hover:text-slate-300">返回员工登录</button>
          </form>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-['Noto_Sans_SC']">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15),transparent_50%)]"></div>
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-2xl relative z-10 text-center animate-in fade-in zoom-in duration-700">
          <div 
             onPointerDown={handleIconClick} 
             className="bg-indigo-600 w-16 h-16 rounded-3xl text-white shadow-2xl shadow-indigo-500/20 mb-8 mx-auto flex items-center justify-center cursor-pointer active:scale-95 transition-transform select-none" 
             style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
             title="连续快速点击7次进入控制台"
          >
             <Zap size={32} fill="currentColor" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">极速脚本</h1>
          <p className="text-slate-400 mb-10 text-sm">内部生产力引擎</p>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <input type="text" placeholder="分配的账号" value={loginInput} onChange={e => setLoginInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none font-bold text-center" />
            <input type="password" placeholder="密码" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none font-bold text-center" />
            {loginError && <p className="text-red-400 text-xs font-bold text-center py-1">{loginError}</p>}
            <button type="submit" disabled={loadingStates['login']} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 font-bold transition-all flex justify-center items-center gap-2">
              {loadingStates['login'] ? <Loader2 className="animate-spin" size={18}/> : '验证身份'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-900 font-['Noto_Sans_SC'] relative">
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-8 cursor-zoom-out animate-in fade-in duration-300" onClick={() => setPreviewImage(null)}>
           <img src={formatImgUrl(previewImage)} className="max-w-full max-h-full rounded-[32px] shadow-2xl border-4 border-white/10" onClick={e => e.stopPropagation()} />
           <button onClick={() => setPreviewImage(null)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors bg-black/20 p-2 rounded-full"><XCircle size={40}/></button>
        </div>
      )}

      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8 z-10 shadow-sm overflow-y-auto">
        <div className="flex items-center space-x-3 mb-2">
           <div 
             onPointerDown={handleIconClick} 
             className="bg-indigo-600 p-1.5 rounded-lg text-white cursor-pointer active:scale-95 transition-transform select-none" 
             title="连续快速点击7次进入控制台"
           >
              <Zap size={18} fill="currentColor" />
           </div>
           <h1 className="text-lg font-black tracking-tight text-slate-900">极速脚本</h1>
        </div>
        <div className="space-y-4"><div className="relative group"><input type="text" placeholder="产品 PID" value={pid} onChange={e => setPid(e.target.value)} className="w-full bg-slate-100 border-none rounded-xl py-3.5 pl-11 pr-4 outline-none font-bold text-xs" /><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} /></div><button onClick={handleFetchProduct} disabled={loadingStates['fetch'] || !pid} className="w-full bg-indigo-600 text-white rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">{loadingStates['fetch'] ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} 采集并分析</button></div>
        <nav className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 pb-2">资产管理</p><SidebarItem icon={<History size={16}/>} label="生成历史" active={activeTab === AppTab.History} onClick={() => setActiveTab(AppTab.History)} count={historyList.length} /><SidebarItem icon={<Trash2 size={16}/>} label="回收站" active={activeTab === AppTab.Trash} onClick={() => setActiveTab(AppTab.Trash)} count={trashList.length} danger /></nav>
        <nav className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 pb-2">创作引擎</p><SidebarItem disabled={!activeItem} icon={<Sparkles size={16}/>} label="产品详情" active={activeTab === AppTab.ProductInfo} onClick={() => setActiveTab(AppTab.ProductInfo)} /><SidebarItem disabled={!activeItem} icon={<Layers size={16}/>} label="三视图画廊" active={activeTab === AppTab.ThreeView} onClick={() => setActiveTab(AppTab.ThreeView)} /><SidebarItem disabled={!activeItem} icon={<User size={16}/>} label="模特图画廊" active={activeTab === AppTab.Interaction} onClick={() => setActiveTab(AppTab.Interaction)} /><SidebarItem disabled={!activeItem} icon={<FileText size={16}/>} label="核心卖点台" active={activeTab === AppTab.SellingPoints} onClick={() => setActiveTab(AppTab.SellingPoints)} /><SidebarItem disabled={!activeItem} icon={<MessageSquare size={16}/>} label="剧本生成舱" active={activeTab === AppTab.Script} onClick={() => setActiveTab(AppTab.Script)} /></nav>
        <div className="mt-auto pt-4"><div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="flex items-center space-x-3 overflow-hidden"><UserCircle className="text-slate-400" size={18} /><p className="text-xs font-bold text-slate-800 truncate">{currentUser.username}</p></div><button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={14} /></button></div></div>
      </aside>

      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-10 py-5 z-20 flex justify-between items-center"><div className="flex items-center gap-4"><div className="flex items-center gap-3"><div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div><h2 className="text-sm font-black text-slate-900 capitalize">{activeTab === AppTab.History ? '专属项目库' : activeTab === AppTab.Trash ? '回收站' : activeItem ? `当前产品: ${activeItem.product?.pid || '未知'}` : '等待采集'}</h2></div></div></div>
        <div className="flex-1 p-10 max-w-7xl mx-auto w-full pb-32">
          
          {activeTab === AppTab.History && ( <div className="space-y-8 animate-in fade-in duration-500"><h3 className="text-2xl font-black">您的专属资产库</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{historyList.map(item => (<HistoryCard key={item.id} item={item} isActive={activeItemId === item.id} onSelect={() => { setActiveItemId(item.id); setActiveTab(AppTab.ProductInfo); }} onDelete={() => { storage.moveToTrash(item.id); refreshUser(); }} />))}{historyList.length === 0 && <EmptyView icon={<History size={24}/>} title="暂无历史" sub="通过采集 PID 开始创作" />}</div></div> )}
          
          {/* ✅ 2. 新增：回收站加入一键硬核清空按钮 */}
          {activeTab === AppTab.Trash && ( 
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-amber-50 border border-amber-100 p-5 rounded-3xl gap-4">
                <div className="flex items-center gap-5">
                  <Clock className="text-amber-600 shrink-0" size={28} />
                  <p className="text-xs text-amber-900 font-bold leading-relaxed">提示：彻底粉碎将同步删除服务器物理硬盘内的所有源文件。</p>
                </div>
                {trashList.length > 0 && (
                  <button 
                    onClick={handleEmptyTrash}
                    disabled={loadingStates['emptyTrash']}
                    className="shrink-0 px-6 py-3 bg-red-500 text-white rounded-2xl font-black text-xs hover:bg-red-600 transition-all flex items-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50"
                  >
                    {loadingStates['emptyTrash'] ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16}/>} 
                    {loadingStates['emptyTrash'] ? '正在粉碎硬盘文件...' : '一键全部清空'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trashList.map(item => (<TrashCard key={item.id} item={item} onRestore={() => { storage.restoreFromTrash(item.id); refreshUser(); }} onDelete={async () => { if(window.confirm("确定要销毁吗？")) { await gemini.deleteBackendProduct(item.product.pid, currentUser.username); storage.permanentDelete(item.id); refreshUser(); } }} />))}
                {trashList.length === 0 && <EmptyView icon={<Trash2 size={24}/>} title="回收站空了" sub="很好，保持整洁" />}
              </div>
            </div> 
          )}

          {activeItem && !['history', 'trash'].includes(activeTab) && (
            <div className="animate-in slide-in-from-bottom-6 duration-500 h-full">
              {activeTab === AppTab.ProductInfo && (
                <div className="bg-white rounded-[48px] p-12 border border-slate-100 shadow-xl space-y-12">
                  <div className="flex flex-col md:flex-row gap-12 items-start">
                    <div className="w-full md:w-1/3 shrink-0"><div className="aspect-[3/4] rounded-[40px] overflow-hidden shadow-2xl border-8 border-white"><img src={formatImgUrl(activeItem.product?.images?.[0] || '')} className="w-full h-full object-cover cursor-zoom-in" onClick={()=>setPreviewImage(formatImgUrl(activeItem.product?.images?.[0] || null))} /></div></div>
                    <div className="flex-1 space-y-8 py-4">
                      <div className="space-y-4"><span className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">产品档案</span><h3 className="text-3xl font-black leading-tight text-slate-900 selectable-text">{activeItem.product?.introduction || '未知产品'}</h3></div>
                      <div className="grid grid-cols-2 gap-y-6 gap-x-12"><InfoLine label="PID" value={activeItem.product?.pid || 'N/A'} selectable /><InfoLine label="品牌" value={activeItem.product?.brand || 'N/A'} selectable /><InfoLine label="发源地" value={activeItem.product?.country || 'N/A'} selectable /><InfoLine label="精细类目" value={activeItem.product?.category || 'N/A'} selectable /></div>
                      <div className="pt-8 border-t border-slate-100 flex items-center gap-6"><div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">建议零售价</p><p className="text-4xl font-black text-indigo-600 selectable-text">{activeItem.product?.price || 'N/A'}</p></div><div className="ml-auto flex gap-2">{(activeItem.product?.images || []).slice(1, 4).map((img, i) => (<div key={i} className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-50 shadow-sm"><img src={formatImgUrl(img)} className="w-full h-full object-cover cursor-zoom-in" onClick={()=>setPreviewImage(formatImgUrl(img))} /></div>))}</div></div>
                    </div>
                  </div>
                  <div className="space-y-6 pt-6"><h4 className="text-lg font-black text-slate-900 flex items-center gap-2"><ImageIcon size={20} className="text-indigo-500" /> 产品图库</h4><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">{(activeItem.product?.images || []).map((img, i) => (<div key={i} className="aspect-square rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 group hover:shadow-lg transition-all"><img src={formatImgUrl(img)} className="w-full h-full object-cover cursor-zoom-in group-hover:scale-110 transition-transform duration-500" onClick={()=>setPreviewImage(formatImgUrl(img))} /></div>))}</div></div>
                </div>
              )}
              
              {activeTab === AppTab.ThreeView && (
                <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] flex flex-col items-center">
                   <div className="text-center space-y-6 w-full max-w-2xl mb-4">
                      <h4 className="text-2xl font-black text-slate-900">生成白底三视图画廊</h4>
                      <p className="text-sm text-slate-500">AI将根据您的全部产品图，输出完美比例的正投三视图。支持多次生成以便挑选最佳版本。</p>
                      <button onClick={handleGenThreeView} disabled={loadingStates['threeView']} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3 mx-auto">{loadingStates['threeView'] ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} {loadingStates['threeView'] ? 'AI 绘制中...' : '生成新三视图'}</button>
                   </div>
                   {renderGalleryWithPreview(activeItem.threeViews, 'threeViews')}
                </div>
              )}

              {activeTab === AppTab.Interaction && (
                <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] flex flex-col items-center">
                   <div className="text-center space-y-8 w-full max-w-2xl mb-4">
                      <div className="flex justify-between items-center mb-6 w-full">
                          <h4 className="text-2xl font-black text-slate-900">生成模特交互画廊</h4>
                          <div className="flex bg-slate-100 p-1.5 rounded-2xl"><button onClick={() => setInteractionMode('default')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${interactionMode === 'default' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>智能生成</button><button onClick={() => setInteractionMode('custom')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${interactionMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>自定义场景</button></div>
                      </div>
                      {interactionMode === 'custom' && ( <textarea placeholder="输入场景描述..." value={customInteractionPrompt} onChange={e => setCustomInteractionPrompt(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-32 transition-all transition-none" /> )}

                      <div className="flex flex-col items-center gap-6 bg-slate-50 p-8 rounded-3xl border border-slate-100">
                        {modelImage ? (
                          <div className="relative group w-32 h-32 rounded-3xl overflow-hidden border-4 border-white shadow-xl cursor-zoom-in" onClick={() => setPreviewImage(modelImage)}><img src={modelImage} className="w-full h-full object-cover" /><button onClick={(e) => { e.stopPropagation(); setModelImage(null); }} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><XCircle size={32}/></button></div>
                        ) : ( <EmptyView icon={<User size={40}/>} title="" sub="上传模特参考图，AI 将其与产品完美融合入画廊" /> )}
                        
                        <div className="flex items-center justify-center gap-4">
                          <label className="px-8 py-4 bg-white rounded-2xl font-black text-xs cursor-pointer hover:bg-slate-100 transition-all border border-slate-200 flex items-center gap-2 shadow-sm">
                            <ImageIcon size={16}/> {modelImage ? "更换参考图" : "上传人物参考图"}
                            <input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onload = ev => setModelImage(ev.target?.result as string); r.readAsDataURL(f); } }} />
                          </label>
                          <button onClick={handleGenInteraction} disabled={loadingStates['interaction']} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3">{loadingStates['interaction'] ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} {loadingStates['interaction'] ? '融合计算中...' : '生成新模特图'}</button>
                        </div>
                      </div>
                   </div>
                   {renderGalleryWithPreview(activeItem.interactions, 'interactions')}
                </div>
              )}

              {activeTab === AppTab.SellingPoints && (() => {
                 const aiPoints = activeItem.sellingPoints || [];
                 const myPoints = activeItem.customPoints || [];
                 const selected = activeItem.selectedPoints || [];
                 const isAiExtracted = aiPoints.length > 0;
                 
                 return (
                  <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm min-h-[600px] flex flex-col items-center">
                     <div className="w-full flex justify-between items-center mb-10 shrink-0">
                        <h4 className="text-2xl font-black text-slate-900">核心卖点控制台</h4>
                        <p className="text-xs font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-xl">☑️ 只有打勾的卖点会投喂给大模型</p>
                     </div>
                     
                     <div className="w-full flex items-center gap-4 mb-8 shrink-0">
                        <input 
                            type="text" 
                            placeholder="手工录入你的独家产品卖点..." 
                            value={customPointInput} 
                            onChange={e => setCustomPointInput(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleAddCustomPoint()} 
                            className="flex-1 h-12 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                        />
                        <button 
                            onClick={handleAddCustomPoint} 
                            disabled={!customPointInput.trim()} 
                            className="h-12 px-6 shrink-0 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                        >
                           <PlusCircle size={18}/> 加入卖点
                        </button>
                     </div>

                     <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch flex-1 min-h-[400px]">
                        
                        <div className="flex flex-col h-full bg-slate-50/50 border border-slate-100 rounded-3xl p-6 shadow-sm">
                           <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4 shrink-0">
                              <span className="text-sm font-black text-indigo-600 flex items-center gap-2"><Sparkles size={16}/> AI 智能提炼区</span>
                              <button 
                                  onClick={handleGenSellingPoints} 
                                  disabled={loadingStates['points']} 
                                  className="text-xs font-bold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                              >
                                 {loadingStates['points'] ? <Loader2 size={14} className="animate-spin"/> : (isAiExtracted ? <RotateCcw size={14}/> : <Sparkles size={14}/>)} 
                                 {loadingStates['points'] ? '处理中...' : (isAiExtracted ? '重新提取' : '开始提取')}
                              </button>
                           </div>
                           <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                              {aiPoints.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10"><Sparkles size={32} className="mb-3 opacity-30"/><p className="text-xs font-bold">点击右上角开始提炼卖点</p></div>}
                              {aiPoints.map((p, i) => {
                                 const isChecked = selected.includes(p);
                                 return (
                                   <div key={`ai-${i}`} onClick={() => togglePointSelection(p)} className={`p-4 rounded-2xl border flex items-start gap-4 cursor-pointer transition-all ${isChecked ? 'border-indigo-500 bg-white shadow-sm' : 'border-slate-200 bg-white/50 hover:border-slate-300'}`}>
                                      <div className="pt-0.5 shrink-0">{isChecked ? <CheckCircle size={20} className="text-indigo-600"/> : <Circle size={20} className="text-slate-300"/>}</div>
                                      <p className={`text-sm font-bold leading-relaxed ${isChecked ? 'text-indigo-900' : 'text-slate-600'}`}>{p}</p>
                                   </div>
                                 )
                              })}
                           </div>
                        </div>

                        <div className="flex flex-col h-full bg-slate-50/50 border border-slate-100 rounded-3xl p-6 shadow-sm">
                           <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4 shrink-0">
                              <span className="text-sm font-black text-slate-700 flex items-center gap-2"><User size={16}/> 人工补充区</span>
                           </div>
                           <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                              {myPoints.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10"><User size={32} className="mb-3 opacity-30"/><p className="text-xs font-bold">暂无人工补充，在上方输入框添加</p></div>}
                              {myPoints.map((p, i) => {
                                 const isChecked = selected.includes(p);
                                 return (
                                   <div key={`cp-${i}`} onClick={() => togglePointSelection(p)} className={`p-4 rounded-2xl border flex items-start gap-4 cursor-pointer transition-all ${isChecked ? 'border-indigo-500 bg-white shadow-sm' : 'border-slate-200 bg-white/50 hover:border-slate-300'}`}>
                                      <div className="pt-0.5 shrink-0">{isChecked ? <CheckCircle size={20} className="text-indigo-600"/> : <Circle size={20} className="text-slate-300"/>}</div>
                                      <p className={`text-sm font-bold flex-1 leading-relaxed ${isChecked ? 'text-indigo-900' : 'text-slate-600'}`}>{p}</p>
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomPoint(p); }} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 size={16}/></button>
                                   </div>
                                 )
                              })}
                           </div>
                        </div>

                     </div>
                  </div>
                 );
              })()}

              {activeTab === AppTab.Script && (() => {
                 const lockedPoints = activeItem.selectedPoints || [];
                 return (
                  <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] flex flex-col">
                     <div className="flex justify-between items-center mb-8"><h4 className="text-2xl font-black text-slate-900">创意营销脚本</h4><div className="flex bg-slate-100 p-1.5 rounded-2xl"><button onClick={() => setScriptMode('default')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${scriptMode === 'default' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>智能脚本</button><button onClick={() => setScriptMode('custom')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${scriptMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>自定义风格</button></div></div>
                     
                     <div className="mb-8 bg-slate-50 rounded-3xl border border-slate-200 p-6 flex flex-col gap-6">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-3"><Settings size={18} className="text-indigo-600"/><h5 className="font-black text-slate-800 text-sm">已向大模型锁定投喂以下核心参数</h5></div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2 text-xs text-slate-700 font-bold">
                              <p className="text-indigo-500 uppercase tracking-widest mb-2">1. 基础产品特征</p>
                              <p className="line-clamp-2">{activeItem.product.introduction}</p>
                              <p>💰 价格：{activeItem.product.price} | 🏷️ 品牌：{activeItem.product.brand}</p>
                           </div>

                           <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                              <p className="text-indigo-500 uppercase tracking-widest mb-2 text-xs">2. 勾选定稿的卖点 ({lockedPoints.length})</p>
                              {lockedPoints.length > 0 ? (
                                 <ul className="list-disc pl-4 text-xs font-bold text-slate-700 h-16 overflow-y-auto pr-2 space-y-1">
                                    {lockedPoints.map(p => <li key={p}>{p}</li>)}
                                 </ul>
                              ) : <span className="text-xs font-bold text-red-500">⚠️ 未勾选任何产品卖点，模型将自由发挥。</span>}
                           </div>

                           <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm md:col-span-2">
                              <p className="text-indigo-500 uppercase tracking-widest mb-2 text-xs">3. 勾选锁定的视觉图像 ({selectedAssets.length})</p>
                              <div className="flex gap-3 overflow-x-auto pb-1">
                                 {selectedAssets.length > 0 ? selectedAssets.map(img => {
                                    const fixedImg = formatImgUrl(img);
                                    return (
                                    <div key={img} className="shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 border-indigo-200 shadow-sm cursor-zoom-in hover:scale-110 transition-transform" onClick={() => setPreviewImage(fixedImg)}><img src={fixedImg} className="w-full h-full object-cover" /></div>
                                 )}) : <span className="text-xs font-bold text-slate-400">未从画廊勾选图像，仅读取基础原图。</span>}
                              </div>
                           </div>
                        </div>
                     </div>

                     {scriptMode === 'custom' && ( <textarea placeholder="输入您的特定风格要求..." value={customScriptPrompt} onChange={e => setCustomScriptPrompt(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-32 mb-8 transition-all transition-none"/> )}

                     {activeItem.script ? (
                       <div className="flex-1 flex flex-col"><div className="flex-1 bg-slate-900 rounded-[32px] p-10 text-slate-200 font-mono text-sm leading-relaxed border-8 border-slate-800 mb-8 whitespace-pre-wrap shadow-inner overflow-y-auto max-h-[500px] selectable-text">{activeItem.script}</div><div className="flex justify-center"><button onClick={handleGenScript} disabled={loadingStates['script']} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3 hover:bg-indigo-700">{loadingStates['script'] ? <Loader2 className="animate-spin" size={16}/> : <RotateCcw size={16}/>} 重算并刷新剧本</button></div></div>
                     ) : (
                       <div className="flex-1 flex flex-col items-center justify-center space-y-8 py-10"><EmptyView icon={<MessageSquare size={40}/>} title="剧本待执行" sub="确认上方控制舱锁定的数据无误后，呼叫大模型执行生成指令。" /><button onClick={handleGenScript} disabled={loadingStates['script']} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3 hover:bg-indigo-700">{loadingStates['script'] ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 执行生成指令</button></div>
                     )}
                  </div>
                 );
              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

/* Subcomponents */
const SidebarItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void, count?: number, danger?: boolean, disabled?: boolean }> = ({ icon, label, active, onClick, count, danger, disabled }) => (<button onClick={onClick} disabled={disabled} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group font-bold text-[13px] ${ active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : disabled ? 'opacity-30 cursor-not-allowed text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900' }`}><span className={active ? 'text-white' : danger ? 'text-red-400' : 'text-slate-400'}>{icon}</span><span className="flex-1 text-left">{label}</span>{count !== undefined && <span className={`text-[10px] px-2.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>{count}</span>}</button>);
const HistoryCard: React.FC<{ item: HistoryItem, isActive: boolean, onSelect: () => void, onDelete: () => void }> = ({ item, isActive, onSelect, onDelete }) => (<div className={`bg-white rounded-3xl p-4 border transition-all group ${isActive ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-2xl' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}><div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 mb-5 cursor-pointer" onClick={onSelect}><img src={formatImgUrl(item.product?.images?.[0] || '')} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" /></div><div className="space-y-4"><h5 className="text-[11px] font-black text-slate-900 line-clamp-2 h-8 leading-relaxed cursor-pointer" onClick={onSelect}>{item.product?.introduction || '未知产品'}</h5><div className="flex justify-between items-center text-[9px] text-slate-400 font-black uppercase tracking-widest"><span>{new Date(item.timestamp).toLocaleDateString()}</span><div className="flex gap-3"><button onClick={onDelete} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button><button onClick={onSelect} className="text-indigo-600">详情</button></div></div></div></div>);
const TrashCard: React.FC<{ item: HistoryItem, onRestore: () => void, onDelete: () => void }> = ({ item, onRestore, onDelete }) => { const daysLeft = 3 - Math.floor((Date.now() - (item.deletedAt || 0)) / (1000 * 60 * 60 * 24)); return (<div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"><div className="flex gap-5"><div className="w-20 h-20 rounded-2xl bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-50"><img src={formatImgUrl(item.product?.images?.[0] || '')} className="w-full h-full object-cover grayscale" /></div><div className="flex-1 space-y-2 py-1"><h5 className="text-xs font-black text-slate-600 line-clamp-1">{item.product?.introduction || '未知产品'}</h5><div className="flex items-center gap-1.5 text-[9px] text-amber-600 font-black uppercase"><Clock size={12} /> {daysLeft}天后自动清理</div><div className="flex gap-4 pt-1"><button onClick={onRestore} className="text-[10px] font-black text-indigo-600 flex items-center gap-1.5"><RotateCcw size={12}/> 恢复项目</button><button onClick={onDelete} className="text-[10px] font-black text-red-400 flex items-center gap-1.5"><XCircle size={12}/> 彻底删除</button></div></div></div></div>); };
const InfoLine: React.FC<{ label: string, value: string, selectable?: boolean }> = ({ label, value, selectable }) => (<div className="flex flex-col gap-1.5 group"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span><span className={`text-sm font-black text-slate-700 group-hover:text-indigo-600 transition-colors ${selectable ? 'selectable-text' : ''}`}>{value}</span></div>);
const EmptyView: React.FC<{ icon: React.ReactNode, title: string, sub: string }> = ({ icon, title, sub }) => (<div className="flex flex-col items-center justify-center py-16 text-center w-full col-span-full"><div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-6 border border-slate-100">{icon}</div><h4 className="text-lg font-black text-slate-800">{title}</h4><p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">{sub}</p></div>);

export default App;
