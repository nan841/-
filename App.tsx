import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Layers, User, Zap, FileText, MessageSquare, Download, Loader2, 
  Image as ImageIcon, LogOut, UserCircle, Sparkles, History, Trash2, RotateCcw, 
  XCircle, Clock, ShieldCheck, UserPlus, Key, CheckCircle, Circle, ZoomIn
} from 'lucide-react';
import { AppTab, UserData, HistoryItem, AllowedUser } from './types';
import * as gemini from './services/geminiService';
import * as storage from './services/storageService';

// 兼容旧版数据的助手函数
const ensureArray = (val: any): string[] => Array.isArray(val) ? val : (val ? [val] : []);

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

  // ✅ 新增：选中的参考图数组 和 全屏灯箱放大查看器状态
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 每次切换商品时，重置勾选框
  useEffect(() => { setSelectedAssets([]); }, [activeItemId]);

  const activeItem = useMemo(() => {
    let item = currentUser?.history.find(h => h.id === activeItemId && !h.deletedAt);
    if (item) {
      // 老版本数据迁移兼容
      const migrated = { ...item };
      if (migrated.threeView) { migrated.threeViews = [migrated.threeView]; delete migrated.threeView; }
      if (migrated.interaction) { migrated.interactions = [migrated.interaction]; delete migrated.interaction; }
      if (!migrated.threeViews) migrated.threeViews = [];
      if (!migrated.interactions) migrated.interactions = [];
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
      const loggedInUser: UserData = { username: res.user.username, lastActiveId: res.user.history?.[0]?.id || null, history: res.user.history || [] };
      storage.setCurrentUser(loggedInUser); setCurrentUser(loggedInUser);
    } catch (error: any) { setLoginError(error.message); } finally { setLoading('login', false); }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === '秦涛' && adminPassword === 'qt20030802') {
      try { const usersList = await gemini.adminGetUsers(adminPassword); setAllowedUsers(usersList); setIsLoggedInAsAdmin(true); } 
      catch (error: any) { alert("获取用户列表失败: " + error.message); }
    } else { alert('管理员身份或密码错误'); }
  };

  const handleIconClick = () => {
    const newCount = iconClicks + 1; setIconClicks(newCount);
    if (newCount >= 10) { setIsAdminMode(true); setIconClicks(0); }
  };

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

  const handleLogout = () => { storage.logoutUser(); setCurrentUser(null); setActiveItemId(null); setIsLoggedInAsAdmin(false); setIsAdminMode(false); };

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

  // ✅ 画廊功能：选中/取消选中图片打勾
  const toggleSelectAsset = (url: string) => {
    setSelectedAssets(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);
  };

  // ✅ 画廊功能：联动物理销毁单张图片
  const handleDeleteAsset = async (type: 'threeViews' | 'interactions', url: string) => {
    if(!window.confirm("确定永久删除此图吗？后端的物理原文件也会被销毁！")) return;
    await gemini.deleteBackendImage(url);
    
    const currentList = ensureArray(activeItem?.[type]);
    const newList = currentList.filter(u => u !== url);
    handleUpdateCurrentItem({ [type]: newList });
    setSelectedAssets(prev => prev.filter(u => u !== url));
  };

  const handleGenThreeView = async () => {
    if (!activeItem || !currentUser) return; setLoading('threeView', true);
    try {
      const res = await gemini.generateThreeView(activeItem.product, currentUser.username);
      if (res) {
        handleUpdateCurrentItem({ threeViews: [res, ...(activeItem.threeViews || [])] });
        setSelectedAssets(prev => [...prev, res]); // 生成完毕后自动帮忙打勾
      }
    } finally { setLoading('threeView', false); }
  };

  const handleGenInteraction = async () => {
    if (!activeItem || !currentUser) return; setLoading('interaction', true);
    try {
      const res = await gemini.generateInteraction(activeItem.product, currentUser.username, modelImage || undefined, interactionMode === 'custom' ? customInteractionPrompt : undefined);
      if (res) {
        handleUpdateCurrentItem({ interactions: [res, ...(activeItem.interactions || [])] });
        setSelectedAssets(prev => [...prev, res]); // 生成完毕后自动帮忙打勾
      }
    } finally { setLoading('interaction', false); }
  };

  const handleGenSellingPoints = async () => {
    if (!activeItem || !currentUser) return; setLoading('points', true);
    try {
      const res = await gemini.generateSellingPoints(activeItem.product, currentUser.username);
      if (res) handleUpdateCurrentItem({ sellingPoints: res });
    } finally { setLoading('points', false); }
  };

  const handleGenScript = async () => {
    if (!activeItem || !activeItem.sellingPoints || !currentUser) return; setLoading('script', true);
    try {
      // ✅ 最强投喂法：只把打勾选中的那些画廊参考图作为上下文投喂给大模型！
      const res = await gemini.generateScript(activeItem.product, currentUser.username, activeItem.sellingPoints, scriptMode === 'custom' ? customScriptPrompt : undefined, selectedAssets);
      if (res) handleUpdateCurrentItem({ script: res });
    } finally { setLoading('script', false); }
  };

  // 🎨 画廊渲染模块
  const renderGallery = (images: string[] | undefined, type: 'threeViews' | 'interactions') => {
    const list = images || [];
    if (list.length === 0) return null;
    return (
      <div className="w-full mt-10 pt-10 border-t border-slate-100 animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2"><ImageIcon size={16}/> 已生成的图库相册 ({list.length})</h4>
          <p className="text-[10px] text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-indigo-100">☑️ 请打勾选中你想让 AI 参考的图片</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {list.map((img, idx) => {
            const isSelected = selectedAssets.includes(img);
            return (
              <div key={idx} className={`relative group rounded-3xl overflow-hidden border-4 aspect-[3/4] bg-white transition-all ${isSelected ? 'border-indigo-500 shadow-xl' : 'border-slate-50 hover:border-slate-200 shadow-sm'}`}>
                <img src={img} className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-500" onClick={() => setPreviewImage(img)} />
                
                {/* 打勾复选框 */}
                <button onClick={(e) => { e.stopPropagation(); toggleSelectAsset(img); }} className="absolute top-4 left-4 p-1 rounded-full bg-white/95 shadow hover:scale-110 transition-transform z-10" title="选中给大模型做剧本参考">
                   {isSelected ? <CheckCircle className="text-indigo-600" size={28}/> : <Circle className="text-slate-300" size={28}/>}
                </button>
                
                {/* 悬浮居中：全屏放大镜 */}
                <button onClick={(e) => { e.stopPropagation(); setPreviewImage(img); }} className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 z-10 backdrop-blur-sm shadow-xl">
                   <ZoomIn size={24} />
                </button>

                {/* 悬浮物理删除按钮 */}
                <button onClick={(e) => { e.stopPropagation(); handleDeleteAsset(type, img); }} className="absolute top-4 right-4 bg-red-500/90 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:scale-110 shadow-lg z-10" title="彻底物理粉碎这张图片">
                   <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 后台与登录保持不变
  if (isLoggedInAsAdmin) {
    return (
      <div className="flex h-screen bg-[#f8fafc] font-['Noto_Sans_SC']">
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8 z-10 shadow-sm">
          <div className="flex items-center space-x-3 mb-2"><div className="bg-slate-900 p-1.5 rounded-lg text-white"><ShieldCheck size={18} /></div><h1 className="text-lg font-black tracking-tight text-slate-900">管理后台</h1></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3">系统管理员：秦涛</p>
          <div className="mt-auto pt-4"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-500 transition-all"><LogOut size={14} /> 退出登录</button></div>
        </aside>
        <main className="flex-1 overflow-y-auto p-10 bg-slate-50">
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2"><h3 className="text-3xl font-black text-slate-900">安全授权管理</h3><p className="text-slate-500 text-sm">分配账号，后端自动拦截非法登录者。</p></div>
            <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative"><UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="新员工用户名" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"/></div>
                <div className="flex-1 relative"><Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="设置登录密码" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"/></div>
                <button onClick={handleAddAllowedUser} disabled={loadingStates['adminAdd']} className="bg-slate-900 text-white rounded-2xl py-3 px-6 text-sm font-bold hover:bg-black transition-all flex items-center gap-2">{loadingStates['adminAdd'] ? <Loader2 className="animate-spin" size={16}/> : <UserPlus size={16} />} 添加授权</button>
              </div>
              <div className="pt-4 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">当前已授权用户 ({allowedUsers.length})</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allowedUsers.map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 font-black text-xs">{u.username[0]}</div><div><p className="text-sm font-black text-slate-900">{u.username}</p><p className="text-[10px] font-bold text-slate-400">{u.password}</p></div></div><button onClick={() => handleDeleteAllowedUser(u.username)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button></div>
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
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-2xl relative animate-in fade-in duration-500 text-center">
          <div className="bg-slate-100 w-16 h-16 rounded-3xl text-slate-900 shadow-2xl mb-8 mx-auto flex items-center justify-center"><ShieldCheck size={32} /></div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">超级管理员入口</h1>
          <form onSubmit={handleAdminLogin} className="space-y-4 text-left mt-8">
            <input type="text" placeholder="身份：秦涛" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none font-bold" />
            <input type="password" placeholder="验证密码" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none font-bold" />
            <button type="submit" className="w-full bg-white text-slate-900 rounded-2xl py-4 font-bold transition-all shadow-xl hover:bg-slate-100">验证进入</button>
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
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-700 text-center">
          <div onClick={handleIconClick} className="bg-indigo-600 w-16 h-16 rounded-3xl text-white shadow-2xl shadow-indigo-500/20 mb-8 mx-auto flex items-center justify-center cursor-pointer active:scale-95 transition-transform select-none"><Zap size={32} fill="currentColor" /></div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">极速脚本</h1>
          <p className="text-slate-400 mb-10 text-sm">仅限被授权的内部账号登入系统</p>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <input type="text" placeholder="分配的账号" value={loginInput} onChange={(e) => setLoginInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none font-bold text-center" />
            <input type="password" placeholder="密码" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none font-bold text-center" />
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
      
      {/* 🔴 电影级全屏放大镜预览器 */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-8 cursor-zoom-out animate-in fade-in duration-300" onClick={() => setPreviewImage(null)}>
           <img src={previewImage} className="max-w-full max-h-full rounded-[32px] shadow-2xl border-4 border-white/10" onClick={e => e.stopPropagation()} />
           <button onClick={() => setPreviewImage(null)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors bg-black/20 p-2 rounded-full"><XCircle size={40}/></button>
        </div>
      )}

      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8 z-10 shadow-sm overflow-y-auto">
        <div className="flex items-center space-x-3 mb-2"><div className="bg-indigo-600 p-1.5 rounded-lg text-white"><Zap size={18} fill="currentColor" /></div><h1 className="text-lg font-black tracking-tight text-slate-900">极速脚本</h1></div>
        <div className="space-y-4">
          <div className="relative group"><input type="text" placeholder="产品 PID" value={pid} onChange={(e) => setPid(e.target.value)} className="w-full bg-slate-100 border-none rounded-xl py-3.5 pl-11 pr-4 outline-none font-bold text-xs" /><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} /></div>
          <button onClick={handleFetchProduct} disabled={loadingStates['fetch'] || !pid} className="w-full bg-indigo-600 text-white rounded-xl py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">{loadingStates['fetch'] ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} 采集并分析</button>
        </div>
        <nav className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 pb-2">资产管理</p><SidebarItem icon={<History size={16}/>} label="生成历史" active={activeTab === AppTab.History} onClick={() => setActiveTab(AppTab.History)} count={historyList.length} /><SidebarItem icon={<Trash2 size={16}/>} label="回收站" active={activeTab === AppTab.Trash} onClick={() => setActiveTab(AppTab.Trash)} count={trashList.length} danger /></nav>
        <nav className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 pb-2">创作引擎</p><SidebarItem disabled={!activeItem} icon={<Sparkles size={16}/>} label="产品详情" active={activeTab === AppTab.ProductInfo} onClick={() => setActiveTab(AppTab.ProductInfo)} /><SidebarItem disabled={!activeItem} icon={<Layers size={16}/>} label="三视图画廊" active={activeTab === AppTab.ThreeView} onClick={() => setActiveTab(AppTab.ThreeView)} /><SidebarItem disabled={!activeItem} icon={<User size={16}/>} label="模特图画廊" active={activeTab === AppTab.Interaction} onClick={() => setActiveTab(AppTab.Interaction)} /><SidebarItem disabled={!activeItem} icon={<FileText size={16}/>} label="核心卖点" active={activeTab === AppTab.SellingPoints} onClick={() => setActiveTab(AppTab.SellingPoints)} /><SidebarItem disabled={!activeItem} icon={<MessageSquare size={16}/>} label="营销脚本" active={activeTab === AppTab.Script} onClick={() => setActiveTab(AppTab.Script)} /></nav>
        <div className="mt-auto pt-4"><div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="flex items-center space-x-3 overflow-hidden"><UserCircle className="text-slate-400" size={18} /><p className="text-xs font-bold text-slate-800 truncate">{currentUser.username}</p></div><button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={14} /></button></div></div>
      </aside>

      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-10 py-5 z-20 flex justify-between items-center"><div className="flex items-center gap-4"><div className="flex items-center gap-3"><div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div><h2 className="text-sm font-black text-slate-900 capitalize">{activeTab === AppTab.History ? '专属项目库' : activeTab === AppTab.Trash ? '回收站' : activeItem ? `当前产品: ${activeItem.product?.pid || '未知'}` : '等待采集'}</h2></div></div></div>
        <div className="flex-1 p-10 max-w-7xl mx-auto w-full pb-32">
          
          {activeTab === AppTab.History && (
             <div className="space-y-8 animate-in fade-in duration-500"><h3 className="text-2xl font-black">您的专属资产库</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{historyList.map(item => (<HistoryCard key={item.id} item={item} isActive={activeItemId === item.id} onSelect={() => { setActiveItemId(item.id); setActiveTab(AppTab.ProductInfo); }} onDelete={() => { storage.moveToTrash(item.id); refreshUser(); }} />))}{historyList.length === 0 && <EmptyView icon={<History size={24}/>} title="暂无历史" sub="通过采集 PID 开始创作" />}</div></div>
          )}
          
          {activeTab === AppTab.Trash && (
             <div className="space-y-8 animate-in fade-in duration-500"><div className="bg-amber-50 border border-amber-100 p-5 rounded-3xl flex items-center gap-5"><Clock className="text-amber-600" size={28} /><p className="text-xs text-amber-900 font-bold leading-relaxed">提示：彻底粉碎将同步删除服务器物理硬盘内的所有源文件。</p></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{trashList.map(item => (<TrashCard key={item.id} item={item} onRestore={() => { storage.restoreFromTrash(item.id); refreshUser(); }} onDelete={async () => { if(window.confirm("确定要彻底销毁项目资料吗？将同步清除物理硬盘数据。")) { await gemini.deleteBackendProduct(item.product.pid, currentUser.username); storage.permanentDelete(item.id); refreshUser(); } }} />))}{trashList.length === 0 && <EmptyView icon={<Trash2 size={24}/>} title="回收站空了" sub="很好，保持整洁" />}</div></div>
          )}

          {activeItem && !['history', 'trash'].includes(activeTab) && (
            <div className="animate-in slide-in-from-bottom-6 duration-500 h-full">
              {activeTab === AppTab.ProductInfo && (
                <div className="bg-white rounded-[48px] p-12 border border-slate-100 shadow-xl space-y-12">
                  <div className="flex flex-col md:flex-row gap-12 items-start">
                    <div className="w-full md:w-1/3 shrink-0"><div className="aspect-[3/4] rounded-[40px] overflow-hidden shadow-2xl border-8 border-white"><img src={activeItem.product?.images?.[0] || ''} className="w-full h-full object-cover cursor-zoom-in" onClick={()=>setPreviewImage(activeItem.product?.images?.[0] || null)} /></div></div>
                    <div className="flex-1 space-y-8 py-4">
                      <div className="space-y-4"><span className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">产品档案</span><h3 className="text-3xl font-black leading-tight text-slate-900 selectable-text">{activeItem.product?.introduction || '未知产品'}</h3></div>
                      <div className="grid grid-cols-2 gap-y-6 gap-x-12"><InfoLine label="PID" value={activeItem.product?.pid || 'N/A'} selectable /><InfoLine label="品牌" value={activeItem.product?.brand || 'N/A'} selectable /><InfoLine label="发源地" value={activeItem.product?.country || 'N/A'} selectable /><InfoLine label="精细类目" value={activeItem.product?.category || 'N/A'} selectable /></div>
                      <div className="pt-8 border-t border-slate-100 flex items-center gap-6"><div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">建议零售价</p><p className="text-4xl font-black text-indigo-600 selectable-text">{activeItem.product?.price || 'N/A'}</p></div><div className="ml-auto flex gap-2">{(activeItem.product?.images || []).slice(1, 4).map((img, i) => (<div key={i} className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-50 shadow-sm"><img src={img} className="w-full h-full object-cover cursor-zoom-in" onClick={()=>setPreviewImage(img)} /></div>))}</div></div>
                    </div>
                  </div>
                  <div className="space-y-6 pt-6"><h4 className="text-lg font-black text-slate-900 flex items-center gap-2"><ImageIcon size={20} className="text-indigo-500" /> 产品图库</h4><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">{(activeItem.product?.images || []).map((img, i) => (<div key={i} className="aspect-square rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 group hover:shadow-lg transition-all"><img src={img} className="w-full h-full object-cover cursor-zoom-in group-hover:scale-110 transition-transform duration-500" onClick={()=>setPreviewImage(img)} /></div>))}</div></div>
                </div>
              )}
              
              {/* ✅ 画廊升级：白底三视图 */}
              {activeTab === AppTab.ThreeView && (
                <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] flex flex-col items-center">
                   <div className="text-center space-y-6 w-full max-w-2xl mb-4">
                      <h4 className="text-2xl font-black text-slate-900">生成白底三视图画廊</h4>
                      <p className="text-sm text-slate-500">AI将根据您的全部产品图，输出完美比例的正投三视图。支持多次生成以便挑选最佳版本。</p>
                      <button onClick={handleGenThreeView} disabled={loadingStates['threeView']} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3 mx-auto">
                        {loadingStates['threeView'] ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} {loadingStates['threeView'] ? 'AI 绘制中...' : '生成新三视图'}
                      </button>
                   </div>
                   {renderGallery(activeItem.threeViews, 'threeViews')}
                </div>
              )}

              {/* ✅ 画廊升级：模特交互图 */}
              {activeTab === AppTab.Interaction && (
                <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] flex flex-col items-center">
                   <div className="text-center space-y-8 w-full max-w-2xl mb-4">
                      <div className="flex justify-between items-center mb-6 w-full">
                          <h4 className="text-2xl font-black text-slate-900">生成模特交互画廊</h4>
                          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                            <button onClick={() => setInteractionMode('default')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${interactionMode === 'default' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>智能生成</button>
                            <button onClick={() => setInteractionMode('custom')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${interactionMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>自定义场景</button>
                          </div>
                      </div>
                      
                      {interactionMode === 'custom' && (
                         <textarea placeholder="输入场景描述..." value={customInteractionPrompt} onChange={e => setCustomInteractionPrompt(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-32 transition-all transition-none" />
                      )}

                      <div className="flex flex-col items-center gap-6 bg-slate-50 p-8 rounded-3xl border border-slate-100">
                        {modelImage ? (
                          <div className="relative group w-32 h-32 rounded-3xl overflow-hidden border-4 border-white shadow-xl cursor-zoom-in" onClick={() => setPreviewImage(modelImage)}>
                            <img src={modelImage} className="w-full h-full object-cover" />
                            <button onClick={(e) => { e.stopPropagation(); setModelImage(null); }} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><XCircle size={32}/></button>
                          </div>
                        ) : (
                          <EmptyView icon={<User size={40}/>} title="" sub="上传模特参考图，AI 将其与产品完美融合入画廊" />
                        )}
                        <div className="flex items-center justify-center gap-4">
                          <label className="px-8 py-4 bg-white rounded-2xl font-black text-xs cursor-pointer hover:bg-slate-100 transition-all border border-slate-200 flex items-center gap-2 shadow-sm">
                            <ImageIcon size={16}/> {modelImage ? "更换参考图" : "上传人物参考图"}
                            <input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onload = ev => setModelImage(ev.target?.result as string); r.readAsDataURL(f); } }} />
                          </label>
                          <button onClick={handleGenInteraction} disabled={loadingStates['interaction']} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3">
                            {loadingStates['interaction'] ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} {loadingStates['interaction'] ? '融合计算中...' : '生成新模特图'}
                          </button>
                        </div>
                      </div>
                   </div>
                   {renderGallery(activeItem.interactions, 'interactions')}
                </div>
              )}

              {activeTab === AppTab.SellingPoints && (
                <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] flex flex-col items-center">
                   <div className="w-full flex justify-between items-center mb-10"><h4 className="text-2xl font-black text-slate-900">核心卖点提炼</h4></div>
                   {activeItem.sellingPoints ? (
                     <div className="w-full space-y-6">
                        <div className="grid gap-4">
                          {(activeItem.sellingPoints || []).map((p, i) => (
                            <div key={i} className="p-8 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-8 group hover:bg-white hover:shadow-xl transition-all">
                               <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-lg shadow-indigo-100">0{i+1}</div>
                               <p className="text-lg font-bold text-slate-800 leading-relaxed selectable-text">{p}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-center pt-10"><button onClick={handleGenSellingPoints} disabled={loadingStates['points']} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3">{loadingStates['points'] ? <Loader2 size={16} className="animate-spin"/> : <RotateCcw size={16}/>} 重新分析</button></div>
                     </div>
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center space-y-8"><EmptyView icon={<FileText size={40}/>} title="分析产品卖点" sub="AI 将深度解析产品描述，提炼 5 个高转化核心卖点" /><button onClick={handleGenSellingPoints} disabled={loadingStates['points']} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3">{loadingStates['points'] ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 开始分析提炼</button></div>
                   )}
                </div>
              )}

              {activeTab === AppTab.Script && (
                <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] flex flex-col">
                   <div className="flex justify-between items-center mb-10">
                      <h4 className="text-2xl font-black text-slate-900">创意营销脚本</h4>
                      <div className="flex bg-slate-100 p-1.5 rounded-2xl"><button onClick={() => setScriptMode('default')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${scriptMode === 'default' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>智能脚本</button><button onClick={() => setScriptMode('custom')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${scriptMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>自定义场景</button></div>
                   </div>
                   {scriptMode === 'custom' && ( <textarea placeholder="输入您的特定要求..." value={customScriptPrompt} onChange={e => setCustomScriptPrompt(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-32 mb-8 transition-all transition-none"/> )}
                   
                   {/* 明确告诉用户 AI 提取了哪些打勾图片 */}
                   <div className="mb-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex flex-col gap-3">
                     <p className="text-xs font-black text-indigo-600">AI 已锁定 {selectedAssets.length} 张你在画廊中【☑️打勾选定】的视觉参考图：</p>
                     <div className="flex gap-3 overflow-x-auto pb-2">
                       {selectedAssets.length > 0 ? selectedAssets.map(img => (
                          <div key={img} className="shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 border-indigo-200 shadow-sm cursor-zoom-in hover:scale-110 transition-transform" onClick={() => setPreviewImage(img)}><img src={img} className="w-full h-full object-cover" /></div>
                       )) : <span className="text-xs text-slate-400">目前画廊中未打勾选定任何参考图，AI 将仅依靠基础原图和卖点生成剧本。</span>}
                     </div>
                   </div>

                   {activeItem.script ? (
                     <div className="flex-1 flex flex-col"><div className="flex-1 bg-slate-950 rounded-[32px] p-10 text-slate-200 font-mono text-sm leading-relaxed border-8 border-slate-800 mb-8 whitespace-pre-wrap shadow-inner overflow-y-auto max-h-[500px] selectable-text">{activeItem.script}</div><div className="flex justify-center"><button onClick={handleGenScript} disabled={loadingStates['script']} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3">{loadingStates['script'] ? <Loader2 className="animate-spin" size={16}/> : <RotateCcw size={16}/>} 重新生成脚本</button></div></div>
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center space-y-8 py-10"><EmptyView icon={<MessageSquare size={40}/>} title="脚本待生成" sub="AI 将精准提取上方您选定的参考素材，编写爆发性剧本。" /><button onClick={handleGenScript} disabled={loadingStates['script']} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3">{loadingStates['script'] ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 一键生成精编脚本</button></div>
                   )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

/* Subcomponents */
const SidebarItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void, count?: number, danger?: boolean, disabled?: boolean }> = ({ icon, label, active, onClick, count, danger, disabled }) => (<button onClick={onClick} disabled={disabled} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group font-bold text-[13px] ${ active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : disabled ? 'opacity-30 cursor-not-allowed text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900' }`}><span className={active ? 'text-white' : danger ? 'text-red-400' : 'text-slate-400'}>{icon}</span><span className="flex-1 text-left">{label}</span>{count !== undefined && <span className={`text-[10px] px-2.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>{count}</span>}</button>);
const HistoryCard: React.FC<{ item: HistoryItem, isActive: boolean, onSelect: () => void, onDelete: () => void }> = ({ item, isActive, onSelect, onDelete }) => (<div className={`bg-white rounded-3xl p-4 border transition-all group ${isActive ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-2xl' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}><div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 mb-5 cursor-pointer" onClick={onSelect}><img src={item.product?.images?.[0] || ''} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" /></div><div className="space-y-4"><h5 className="text-[11px] font-black text-slate-900 line-clamp-2 h-8 leading-relaxed cursor-pointer" onClick={onSelect}>{item.product?.introduction || '未知产品'}</h5><div className="flex justify-between items-center text-[9px] text-slate-400 font-black uppercase tracking-widest"><span>{new Date(item.timestamp).toLocaleDateString()}</span><div className="flex gap-3"><button onClick={onDelete} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button><button onClick={onSelect} className="text-indigo-600">详情</button></div></div></div></div>);
const TrashCard: React.FC<{ item: HistoryItem, onRestore: () => void, onDelete: () => void }> = ({ item, onRestore, onDelete }) => { const daysLeft = 3 - Math.floor((Date.now() - (item.deletedAt || 0)) / (1000 * 60 * 60 * 24)); return (<div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"><div className="flex gap-5"><div className="w-20 h-20 rounded-2xl bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-50"><img src={item.product?.images?.[0] || ''} className="w-full h-full object-cover grayscale" /></div><div className="flex-1 space-y-2 py-1"><h5 className="text-xs font-black text-slate-600 line-clamp-1">{item.product?.introduction || '未知产品'}</h5><div className="flex items-center gap-1.5 text-[9px] text-amber-600 font-black uppercase"><Clock size={12} /> {daysLeft}天后自动清理</div><div className="flex gap-4 pt-1"><button onClick={onRestore} className="text-[10px] font-black text-indigo-600 flex items-center gap-1.5"><RotateCcw size={12}/> 恢复项目</button><button onClick={onDelete} className="text-[10px] font-black text-red-400 flex items-center gap-1.5"><XCircle size={12}/> 彻底删除</button></div></div></div></div>); };
const InfoLine: React.FC<{ label: string, value: string, selectable?: boolean }> = ({ label, value, selectable }) => (<div className="flex flex-col gap-1.5 group"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span><span className={`text-sm font-black text-slate-700 group-hover:text-indigo-600 transition-colors ${selectable ? 'selectable-text' : ''}`}>{value}</span></div>);
const EmptyView: React.FC<{ icon: React.ReactNode, title: string, sub: string }> = ({ icon, title, sub }) => (<div className="flex flex-col items-center justify-center py-16 text-center w-full col-span-full"><div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-6 border border-slate-100">{icon}</div><h4 className="text-lg font-black text-slate-800">{title}</h4><p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">{sub}</p></div>);

export default App;
