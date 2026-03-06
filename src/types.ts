export interface Deal {
  name: string;
  win: string;
  where: string;
  action: string;
}

export interface DealCategory {
  category: string;
  deals: Deal[];
}
