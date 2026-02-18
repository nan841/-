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
  
  threeViews?: string[]; 
  interactions?: string[]; 
  
  // ✅ 卖点体系全面升级
  sellingPoints?: string[];     // AI生成的卖点
  customPoints?: string[];      // 员工手动添加的补充卖点
  selectedPoints?: string[];    // 最终打勾选定、投喂给剧本大模型的卖点
  
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
