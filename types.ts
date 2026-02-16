export enum AppTab {
  ProductInfo = 'productInfo',
  ThreeView = 'threeView',
  Interaction = 'interaction',
  SellingPoints = 'sellingPoints',
  Script = 'script',
  History = 'history',
  Trash = 'trash'
}

export interface ProductInfo {
  pid: string;
  introduction: string;
  brand: string;
  country: string;
  category: string;
  price: string;
  images: string[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  product: ProductInfo;
  
  // ✅ 核心升级：兼容旧数据，开启全新的无限画廊数组
  threeView?: string; 
  threeViews?: string[]; 
  
  interaction?: string; 
  interactions?: string[]; 
  
  sellingPoints?: string[];
  script?: string;
  deletedAt?: number;
}

export interface UserData {
  username: string;
  lastActiveId?: string | null;
  history: HistoryItem[];
}

export interface AllowedUser {
  username: string;
  password?: string;
}
