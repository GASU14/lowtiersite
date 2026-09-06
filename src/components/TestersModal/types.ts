export type TesterTab = 'announcements' | 'chat' | 'bug_reports' | 'suggestions';

export interface TesterPost {
  id: string;
  tab: TesterTab;
  content: string;
  imageUrl?: string;
  authorName: string;
  authorId?: string;
  authorBadge?: string;
  createdAt: number;
}

export interface TesterUser {
  uid: string;
  username: string;
  email: string;
  badge?: string;
}
