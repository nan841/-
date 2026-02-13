
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
  deletedAt?: number; // 存在则表示在回收站中
  product: ProductInfo;
  threeView?: string;
  interaction?: string;
  sellingPoints?: string[];
  script?: string;
}

export interface AllowedUser {
  username: string;
  password: string;
}

export interface UserData {
  username: string;
  history: HistoryItem[];
  lastActiveId?: string;
}

export enum AppTab {
  ProductInfo = 'product',
  ThreeView = 'three_view',
  Interaction = 'interaction',
  SellingPoints = 'selling_points',
  Script = 'script',
  History = 'history',
  Trash = 'trash',
  AdminPanel = 'admin_panel'
}
