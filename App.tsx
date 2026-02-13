
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, Layers, User, Zap, FileText, MessageSquare,
  ChevronRight, Download, Loader2, 
  Image as ImageIcon, LogOut, UserCircle, Sparkles,
  History, Trash2, RotateCcw, XCircle, Clock, Globe, ExternalLink, ArrowRight, ShieldCheck, UserPlus, Key, Check
} from 'lucide-react';
import { ProductInfo, AppTab, UserData, HistoryItem, AllowedUser } from './types';
import * as gemini from './services/geminiService';
import * as storage from './services/storageService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // 管理员相关状态
  const [iconClicks, setIconClicks] = useState(0);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoggedInAsAdmin, setIsLoggedInAsAdmin] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');

  const [pid, setPid] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.ProductInfo);
  
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'default' | 'custom'>('default');
  const [customInteractionPrompt, setCustomInteractionPrompt] = useState('');
  const [scriptMode, setScriptMode] = useState<'default' | 'custom'>('default');
  const [customScriptPrompt, setCustomScriptPrompt] = useState('');

  const activeItem = useMemo(() => {
    return currentUser?.history.find(h => h.id === activeItemId && !h.deletedAt) || null;
  }, [currentUser, activeItemId]);

  const historyList = useMemo(() => {
    return currentUser?.history.filter(h => !h.deletedAt).sort((a,b) => b.timestamp - a.timestamp) || [];
  }, [currentUser]);

  const trashList = useMemo(() => {
    return currentUser?.history.filter(h => !!h.deletedAt).sort((a,b) => b.deletedAt! - a.deletedAt!) || [];
  }, [currentUser]);

  useEffect(() => {
    const user = storage.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      if (user.lastActiveId) setActiveItemId(user.lastActiveId);
    }
    setAllowedUsers(storage.getAllowedUsers());
  }, []);

  const refreshUser = () => {
    const user = storage.getCurrentUser();
    setCurrentUser(user);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginInput.trim() || !passwordInput.trim()) return;
    const user = storage.loginUser(loginInput.trim(), passwordInput.trim());
    if (user) {
      setCurrentUser(user);
      if (user.lastActiveId) setActiveItemId(user.lastActiveId);
    } else {
      setLoginError('用户名或密码错误，或未获得授权。');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === '秦涛' && adminPassword === 'qt20030802') {
      setIsLoggedInAsAdmin(true);
      setAllowedUsers(storage.getAllowedUsers());
    } else {
      alert('管理员身份或密码错误');
    }
  };

  const handleIconClick = () => {
    const newCount = iconClicks + 1;
    setIconClicks(newCount);
    if (newCount >= 10) {
      setIsAdminMode(true);
      setIconClicks(0);
    }
  };

  const handleAddAllowedUser = () => {
    if (!newUserName.trim() || !newUserPass.trim()) return;
    const newList = [...allowedUsers, { username: newUserName.trim(), password: newUserPass.trim() }];
    setAllowedUsers(newList);
    storage.saveAllowedUsers(newList);
    setNewUserName('');
    setNewUserPass('');
  };

  const handleDeleteAllowedUser = (username: string) => {
    const newList = allowedUsers.filter(u => u.username !== username);
    setAllowedUsers(newList);
    storage.saveAllowedUsers(newList);
  };

  const handleLogout = () => {
    storage.logoutUser();
    setCurrentUser(null);
    setActiveItemId(null);
    setIsLoggedInAsAdmin(false);
    setIsAdminMode(false);
  };

  const handleFetchProduct = async () => {
    if (!pid) return;
    setLoading(true);
    try {
      const info = await gemini.analyzeProductWithSearch(pid);
      if (info) {
        const newItem: HistoryItem = {
          id: `${Date.now()}-${pid}`,
          timestamp: Date.now(),
          product: info
        };
        storage.updateHistoryItem(newItem);
        setActiveItemId(newItem.id);
        setActiveTab(AppTab.ProductInfo);
        refreshUser();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportProject = async () => {
    if (!activeItem || isExporting) return;
    setIsExporting(true);
    
    // 模拟处理时间，提供视觉反馈
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const dataStr = JSON.stringify(activeItem, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `项目导出-${activeItem.product.pid}-${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateCurrentItem = (updates: Partial<HistoryItem>) => {
    if (!activeItem) return;
    const updated = { ...activeItem, ...updates };
    storage.updateHistoryItem(updated);
    refreshUser();
  };

  const handleGenThreeView = async () => {
    if (!activeItem) return;
    setLoading(true);
    try {
      const res = await gemini.generateThreeView(activeItem.product);
      handleUpdateCurrentItem({ threeView: res || undefined });
    } finally {
      setLoading(false);
    }
  };

  const handleGenInteraction = async () => {
    if (!activeItem) return;
    setLoading(true);
    try {
      const res = await gemini.generateInteraction(
        activeItem.product, 
        modelImage || undefined,
        interactionMode === 'custom' ? customInteractionPrompt : undefined
      );
      handleUpdateCurrentItem({ interaction: res || undefined });
    } finally {
      setLoading(false);
    }
  };

  const handleGenSellingPoints = async () => {
    if (!activeItem) return;
    setLoading(true);
    try {
      const res = await gemini.generateSellingPoints(activeItem.product);
      handleUpdateCurrentItem({ sellingPoints: res });
    } finally {
      setLoading(false);
    }
  };

  const handleGenScript = async () => {
    if (!activeItem || !activeItem.sellingPoints) return;
    setLoading(true);
    try {
      const res = await gemini.generateScript(
        activeItem.product, 
        activeItem.sellingPoints, 
        scriptMode === 'custom' ? customScriptPrompt : undefined
      );
      handleUpdateCurrentItem({ script: res });
    } finally {
      setLoading(false);
    }
  };

  // 管理员后台视图
  if (isLoggedInAsAdmin) {
    return (
      <div className="flex h-screen bg-[#f8fafc] font-['Noto_Sans_SC']">
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8 z-10 shadow-sm">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-slate-900 p-1.5 rounded-lg text-white">
              <ShieldCheck size={18} />
            </div>
            <h1 className="text-lg font-black tracking-tight text-slate-900">管理后台</h1>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3">系统管理员：秦涛</p>
          <div className="mt-auto pt-4">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-500 transition-all">
              <LogOut size={14} /> 退出登录
            </button>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto p-10 bg-slate-50">
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
              <h3 className="text-3xl font-black text-slate-900">用户权限管理</h3>
              <p className="text-slate-500 text-sm">在这里管理可以访问“极速脚本”的用户名单。</p>
            </div>

            <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="新用户名称" 
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                </div>
                <div className="flex-1 relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="新用户密码" 
                    value={newUserPass}
                    onChange={e => setNewUserPass(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                </div>
                <button 
                  onClick={handleAddAllowedUser}
                  className="bg-slate-900 text-white rounded-2xl py-3 px-6 text-sm font-bold hover:bg-black transition-all flex items-center gap-2"
                >
                  <UserPlus size={16} /> 添加授权
                </button>
              </div>

              <div className="pt-4 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">当前已授权用户 ({allowedUsers.length})</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allowedUsers.map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 font-black text-xs">{u.username[0]}</div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{u.username}</p>
                          <p className="text-[10px] font-bold text-slate-400">{u.password}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteAllowedUser(u.username)} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {allowedUsers.length === 0 && <p className="text-xs text-slate-400 col-span-full py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">暂无已授权用户</p>}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 管理员登录模式
  if (isAdminMode && !isLoggedInAsAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-['Noto_Sans_SC']">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-2xl relative animate-in fade-in duration-500 text-center">
          <div className="bg-slate-100 w-16 h-16 rounded-3xl text-slate-900 shadow-2xl mb-8 mx-auto flex items-center justify-center">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">管理员登录</h1>
          <p className="text-slate-400 mb-10 text-sm">系统安全验证区域</p>
          <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
            <input 
              type="text" 
              placeholder="管理员身份"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder-slate-600 focus:ring-2 focus:ring-slate-100 transition-all outline-none font-bold"
            />
            <input 
              type="password" 
              placeholder="管理员密码"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder-slate-600 focus:ring-2 focus:ring-slate-100 transition-all outline-none font-bold"
            />
            <button type="submit" className="w-full bg-white text-slate-900 rounded-2xl py-4 font-bold transition-all shadow-xl hover:bg-slate-100">验证进入</button>
            <button type="button" onClick={() => setIsAdminMode(false)} className="w-full text-slate-500 text-xs font-bold py-2 hover:text-slate-300">返回用户登录</button>
          </form>
        </div>
      </div>
    );
  }

  // 普通用户登录
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-['Noto_Sans_SC']">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15),transparent_50%)]"></div>
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-700 text-center">
          <div 
            onClick={handleIconClick}
            className="bg-indigo-600 w-16 h-16 rounded-3xl text-white shadow-2xl shadow-indigo-500/20 mb-8 mx-auto flex items-center justify-center cursor-pointer active:scale-95 transition-transform select-none"
          >
            <Zap size={32} fill="currentColor" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">极速脚本</h1>
          <p className="text-slate-400 mb-10 text-sm">您的全能电商选品视觉工作台</p>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <input 
              type="text" 
              placeholder="请输入用户名"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold text-center"
            />
            <input 
              type="password" 
              placeholder="请输入密码"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold text-center"
            />
            {loginError && <p className="text-red-400 text-xs font-bold text-center py-1">{loginError}</p>}
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 font-bold transition-all shadow-xl shadow-indigo-600/20">进入系统</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-900 font-['Noto_Sans_SC']">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8 z-10 shadow-sm overflow-y-auto">
        <div className="flex items-center space-x-3 mb-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
            <Zap size={18} fill="currentColor" />
          </div>
          <h1 className="text-lg font-black tracking-tight text-slate-900">极速脚本</h1>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3">采集工作</p>
          <div className="relative group">
            <input 
              type="text" 
              placeholder="产品 PID"
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-indigo-500 transition-all text-xs outline-none font-bold"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          </div>
          <button 
            onClick={handleFetchProduct} 
            disabled={loading || !pid} 
            className="w-full bg-indigo-600 text-white rounded-xl py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} 采集并分析
          </button>
        </div>

        <nav className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 pb-2">资产管理</p>
          <SidebarItem icon={<History size={16}/>} label="生成历史" active={activeTab === AppTab.History} onClick={() => setActiveTab(AppTab.History)} count={historyList.length} />
          <SidebarItem icon={<Trash2 size={16}/>} label="回收站" active={activeTab === AppTab.Trash} onClick={() => setActiveTab(AppTab.Trash)} count={trashList.length} danger />
        </nav>

        <nav className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 pb-2">创作引擎</p>
          <SidebarItem 
            disabled={!activeItem}
            icon={<Sparkles size={16}/>} 
            label="产品详情" 
            active={activeTab === AppTab.ProductInfo} 
            onClick={() => setActiveTab(AppTab.ProductInfo)} 
          />
          <SidebarItem 
            disabled={!activeItem}
            icon={<Layers size={16}/>} 
            label="三视图" 
            active={activeTab === AppTab.ThreeView} 
            onClick={() => setActiveTab(AppTab.ThreeView)} 
          />
          <SidebarItem 
            disabled={!activeItem}
            icon={<User size={16}/>} 
            label="模特图" 
            active={activeTab === AppTab.Interaction} 
            onClick={() => setActiveTab(AppTab.Interaction)} 
          />
          <SidebarItem 
            disabled={!activeItem}
            icon={<FileText size={16}/>} 
            label="核心卖点" 
            active={activeTab === AppTab.SellingPoints} 
            onClick={() => setActiveTab(AppTab.SellingPoints)} 
          />
          <SidebarItem 
            disabled={!activeItem}
            icon={<MessageSquare size={16}/>} 
            label="营销脚本" 
            active={activeTab === AppTab.Script} 
            onClick={() => setActiveTab(AppTab.Script)} 
          />
        </nav>

        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center space-x-3 overflow-hidden">
              <UserCircle className="text-slate-400" size={18} />
              <p className="text-xs font-bold text-slate-800 truncate">{currentUser.username}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
               <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-10 py-5 z-20 flex justify-between items-center">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                 <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                 <h2 className="text-sm font-black text-slate-900 capitalize">
                   {activeTab === AppTab.History ? '项目库' : 
                    activeTab === AppTab.Trash ? '回收站' : 
                    activeItem ? `当前产品: ${activeItem.product.pid}` : '等待采集'}
                 </h2>
              </div>
              {loading && <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-black animate-pulse"><Loader2 className="animate-spin" size={12}/> AI 处理中...</div>}
           </div>
           {activeItem && !activeItem.deletedAt && !['history', 'trash'].includes(activeTab) && (
             <button 
                onClick={handleExportProject}
                disabled={isExporting}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-70"
              >
               {isExporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
               {isExporting ? '导出中...' : '导出项目'}
             </button>
           )}
        </div>

        <div className="flex-1 p-10 max-w-7xl mx-auto w-full">
          {activeTab === AppTab.History && (
             <div className="space-y-8 animate-in fade-in duration-500">
                <h3 className="text-2xl font-black">项目库</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                   {historyList.map(item => (
                     <HistoryCard key={item.id} item={item} isActive={activeItemId === item.id} onSelect={() => { setActiveItemId(item.id); setActiveTab(AppTab.ProductInfo); }} onDelete={() => { storage.moveToTrash(item.id); refreshUser(); }} />
                   ))}
                   {historyList.length === 0 && <EmptyView icon={<History size={24}/>} title="暂无历史" sub="通过采集 PID 开始创作" />}
                </div>
             </div>
          )}

          {activeTab === AppTab.Trash && (
             <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-amber-50 border border-amber-100 p-5 rounded-3xl flex items-center gap-5">
                   <Clock className="text-amber-600" size={28} />
                   <p className="text-xs text-amber-900 font-bold leading-relaxed">回收站内的项目将在 3 天后永久删除。</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {trashList.map(item => (
                     <TrashCard key={item.id} item={item} onRestore={() => { storage.restoreFromTrash(item.id); refreshUser(); }} onDelete={() => { if(confirm("彻底删除不可恢复，确定吗？")) { storage.permanentDelete(item.id); refreshUser(); } }} />
                   ))}
                   {trashList.length === 0 && <EmptyView icon={<Trash2 size={24}/>} title="回收站空了" sub="很好，保持整洁" />}
                </div>
             </div>
          )}

          {activeItem && !['history', 'trash'].includes(activeTab) && (
            <div className="animate-in slide-in-from-bottom-6 duration-500 h-full">
              {activeTab === AppTab.ProductInfo && (
                <div className="bg-white rounded-[48px] p-12 border border-slate-100 shadow-xl space-y-12">
                  <div className="flex flex-col md:flex-row gap-12 items-start">
                    <div className="w-full md:w-1/3 shrink-0">
                      <div className="aspect-[3/4] rounded-[40px] overflow-hidden shadow-2xl border-8 border-white">
                        <img src={activeItem.product.images[0]} className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-8 py-4">
                      <div className="space-y-4">
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">产品档案</span>
                        <h3 className="text-3xl font-black leading-tight text-slate-900 selectable-text">{activeItem.product.introduction}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                        <InfoLine label="PID" value={activeItem.product.pid} selectable />
                        <InfoLine label="品牌" value={activeItem.product.brand} selectable />
                        <InfoLine label="发源地" value={activeItem.product.country} selectable />
                        <InfoLine label="精细类目" value={activeItem.product.category} selectable />
                      </div>
                      <div className="pt-8 border-t border-slate-100 flex items-center gap-6">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">建议零售价</p>
                          <p className="text-4xl font-black text-indigo-600 selectable-text">{activeItem.product.price}</p>
                        </div>
                        <div className="ml-auto flex gap-2">
                           {activeItem.product.images.slice(1, 4).map((img, i) => (
                             <div key={i} className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-50 shadow-sm">
                               <img src={img} className="w-full h-full object-cover" />
                             </div>
                           ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6 pt-6">
                    <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <ImageIcon size={20} className="text-indigo-500" /> 产品图库
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {activeItem.product.images.map((img, i) => (
                        <div key={i} className="aspect-square rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 group hover:shadow-lg transition-all">
                           <img src={img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === AppTab.ThreeView && (
                <div className="flex flex-col items-center bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] justify-center">
                  {activeItem.threeView ? (
                    <div className="w-full max-w-4xl space-y-10 animate-in zoom-in duration-500 text-center">
                      <img src={activeItem.threeView} className="w-full rounded-3xl shadow-2xl border-4 border-white" />
                      <button onClick={handleGenThreeView} disabled={loading} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">重新生成三视图</button>
                    </div>
                  ) : (
                    <div className="text-center space-y-8">
                       <EmptyView icon={<Layers size={40}/>} title="尚未生成三视图" sub="基于产品描述生成白底三视图素材" />
                       <button onClick={handleGenThreeView} disabled={loading} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3 mx-auto">
                         {loading ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 立即生成
                       </button>
                    </div>
                  )}
                </div>
              )}
              {activeTab === AppTab.Interaction && (
                <div className="flex flex-col items-center bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] justify-center">
                  {activeItem.interaction ? (
                    <div className="max-w-md w-full space-y-10 animate-in zoom-in duration-500 text-center">
                       <img src={activeItem.interaction} className="w-full rounded-[48px] shadow-2xl border-8 border-white" />
                       <button onClick={handleGenInteraction} disabled={loading} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all">重新生成模特图</button>
                    </div>
                  ) : (
                    <div className="text-center space-y-8 w-full max-w-2xl">
                       <div className="flex justify-between items-center mb-6 w-full">
                          <h4 className="text-2xl font-black text-slate-900">模特图生成</h4>
                          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                            <button onClick={() => setInteractionMode('default')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${interactionMode === 'default' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>智能生成</button>
                            <button onClick={() => setInteractionMode('custom')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${interactionMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>自定义提示词</button>
                          </div>
                       </div>

                       {interactionMode === 'custom' && (
                         <textarea 
                            placeholder="输入您希望生成的场景描述（例如：金发模特的在海边度假的自拍，光线明亮）..."
                            value={customInteractionPrompt}
                            onChange={e => setCustomInteractionPrompt(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-32 mb-8 transition-all transition-none"
                         />
                       )}

                       <EmptyView icon={<User size={40}/>} title="尚未生成模特图" sub="上传模特参考图，AI 将其与产品完美融合" />
                       {modelImage && (
                         <div className="mx-auto w-32 h-32 rounded-3xl overflow-hidden border-4 border-white shadow-xl mb-4 relative group">
                            <img src={modelImage} className="w-full h-full object-cover" />
                            <button onClick={() => setModelImage(null)} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><XCircle size={20}/></button>
                         </div>
                       )}
                       <div className="flex items-center justify-center gap-4">
                         <label className="px-8 py-4 bg-slate-100 rounded-2xl font-black text-xs cursor-pointer hover:bg-slate-200 transition-all border border-slate-200 flex items-center gap-2">
                           <ImageIcon size={16}/> {modelImage ? "更换参考图" : "上传参考图"}
                           <input type="file" className="hidden" accept="image/*" onChange={e => {
                             const f = e.target.files?.[0];
                             if(f){
                               const r = new FileReader();
                               r.onload = ev => setModelImage(ev.target?.result as string);
                               r.readAsDataURL(f);
                             }
                           }} />
                         </label>
                         <button onClick={handleGenInteraction} disabled={loading} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3">
                           {loading ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 立即生成
                         </button>
                       </div>
                    </div>
                  )}
                </div>
              )}
              {activeTab === AppTab.SellingPoints && (
                <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] flex flex-col items-center">
                   <div className="w-full flex justify-between items-center mb-10">
                      <h4 className="text-2xl font-black text-slate-900">核心卖点提炼</h4>
                   </div>
                   {activeItem.sellingPoints ? (
                     <div className="w-full space-y-6">
                        <div className="grid gap-4">
                          {activeItem.sellingPoints.map((p, i) => (
                            <div key={i} className="p-8 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-8 group hover:bg-white hover:shadow-xl transition-all">
                               <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-lg shadow-indigo-100">0{i+1}</div>
                               <p className="text-lg font-bold text-slate-800 leading-relaxed selectable-text">{p}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-center pt-10">
                          <button onClick={handleGenSellingPoints} disabled={loading} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3">
                            {loading ? <Loader2 size={16} className="animate-spin"/> : <RotateCcw size={16}/>} 重新分析
                          </button>
                        </div>
                     </div>
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                       <EmptyView icon={<FileText size={40}/>} title="分析产品卖点" sub="AI 将深度解析产品描述，提炼 5 个高转化核心卖点" />
                       <button onClick={handleGenSellingPoints} disabled={loading} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3">
                         {loading ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 开始分析提炼
                       </button>
                     </div>
                   )}
                </div>
              )}
              {activeTab === AppTab.Script && (
                <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-sm min-h-[600px] flex flex-col">
                   <div className="flex justify-between items-center mb-10">
                      <h4 className="text-2xl font-black text-slate-900">创意营销脚本</h4>
                      <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                        <button onClick={() => setScriptMode('default')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${scriptMode === 'default' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>智能脚本</button>
                        <button onClick={() => setScriptMode('custom')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${scriptMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>自定义场景</button>
                      </div>
                   </div>
                   {scriptMode === 'custom' && (
                     <textarea 
                        placeholder="输入您的特定要求..."
                        value={customScriptPrompt}
                        onChange={e => setCustomScriptPrompt(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-32 mb-8 transition-all transition-none"
                     />
                   )}
                   {activeItem.script ? (
                     <div className="flex-1 flex flex-col">
                        <div className="flex-1 bg-slate-950 rounded-[32px] p-10 text-slate-200 font-mono text-sm leading-relaxed border-8 border-slate-800 mb-8 whitespace-pre-wrap shadow-inner overflow-y-auto max-h-[500px] selectable-text">
                          {activeItem.script}
                        </div>
                        <div className="flex justify-center">
                          <button onClick={handleGenScript} disabled={loading} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3">
                             {loading ? <Loader2 className="animate-spin" size={16}/> : <RotateCcw size={16}/>} 重新生成脚本
                          </button>
                        </div>
                     </div>
                   ) : (
                     <div className="flex-1 flex flex-col items-center justify-center space-y-8 py-20">
                        <EmptyView icon={<MessageSquare size={40}/>} title="脚本待生成" sub="基于卖点一键生成 TikTok/直播 黄金脚本" />
                        <button onClick={handleGenScript} disabled={loading} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3">
                           {loading ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 一键生成脚本
                        </button>
                     </div>
                   )}
                </div>
              )}
            </div>
          )}
          {!activeItem && !['history', 'trash'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in duration-700">
               <div className="w-32 h-32 bg-white rounded-[40px] shadow-2xl border border-slate-100 flex items-center justify-center text-indigo-500 animate-bounce">
                 <Zap size={48} fill="currentColor" />
               </div>
               <div className="text-center space-y-3">
                 <h3 className="text-2xl font-black text-slate-900">准备就绪，开启创作</h3>
                 <p className="text-slate-500 max-w-sm font-medium">在左侧栏输入产品 PID 并点击采集按钮，AI 将为您自动生成全套营销物料。</p>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

/* Subcomponents */

const SidebarItem: React.FC<{ 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  onClick: () => void, 
  count?: number, 
  danger?: boolean,
  disabled?: boolean
}> = ({ icon, label, active, onClick, count, danger, disabled }) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group font-bold text-[13px] ${
      active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 
      disabled ? 'opacity-30 cursor-not-allowed text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <span className={active ? 'text-white' : danger ? 'text-red-400' : 'text-slate-400'}>{icon}</span>
    <span className="flex-1 text-left">{label}</span>
    {count !== undefined && <span className={`text-[10px] px-2.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>{count}</span>}
  </button>
);

const HistoryCard: React.FC<{ item: HistoryItem, isActive: boolean, onSelect: () => void, onDelete: () => void }> = ({ item, isActive, onSelect, onDelete }) => (
  <div className={`bg-white rounded-3xl p-4 border transition-all group ${isActive ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-2xl' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}>
    <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 mb-5 cursor-pointer" onClick={onSelect}>
      <img src={item.product.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
    </div>
    <div className="space-y-4">
      <h5 className="text-[11px] font-black text-slate-900 line-clamp-2 h-8 leading-relaxed cursor-pointer" onClick={onSelect}>{item.product.introduction}</h5>
      <div className="flex justify-between items-center text-[9px] text-slate-400 font-black uppercase tracking-widest">
        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
        <div className="flex gap-3">
           <button onClick={onDelete} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
           <button onClick={onSelect} className="text-indigo-600">详情</button>
        </div>
      </div>
    </div>
  </div>
);

const TrashCard: React.FC<{ item: HistoryItem, onRestore: () => void, onDelete: () => void }> = ({ item, onRestore, onDelete }) => {
  const daysLeft = 3 - Math.floor((Date.now() - (item.deletedAt || 0)) / (1000 * 60 * 60 * 24));
  return (
    <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex gap-5">
        <div className="w-20 h-20 rounded-2xl bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-50">
           <img src={item.product.images[0]} className="w-full h-full object-cover grayscale" />
        </div>
        <div className="flex-1 space-y-2 py-1">
          <h5 className="text-xs font-black text-slate-600 line-clamp-1">{item.product.introduction}</h5>
          <div className="flex items-center gap-1.5 text-[9px] text-amber-600 font-black uppercase">
            <Clock size={12} /> {daysLeft}天后自动清理
          </div>
          <div className="flex gap-4 pt-1">
             <button onClick={onRestore} className="text-[10px] font-black text-indigo-600 flex items-center gap-1.5"><RotateCcw size={12}/> 恢复项目</button>
             <button onClick={onDelete} className="text-[10px] font-black text-red-400 flex items-center gap-1.5"><XCircle size={12}/> 彻底删除</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoLine: React.FC<{ label: string, value: string, selectable?: boolean }> = ({ label, value, selectable }) => (
  <div className="flex flex-col gap-1.5 group">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <span className={`text-sm font-black text-slate-700 group-hover:text-indigo-600 transition-colors ${selectable ? 'selectable-text' : ''}`}>{value}</span>
  </div>
);

const EmptyView: React.FC<{ icon: React.ReactNode, title: string, sub: string }> = ({ icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center w-full col-span-full">
    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-6 border border-slate-100">
      {icon}
    </div>
    <h4 className="text-lg font-black text-slate-800">{title}</h4>
    <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">{sub}</p>
  </div>
);

export default App;
