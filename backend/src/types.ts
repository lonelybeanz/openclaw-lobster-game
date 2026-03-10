export type MemberLevel = {
  id: number;
  name: string;
  level: number;
  experience: number;
  discountPercent: number;
  icon: string | null;
  backgroundUrl: string | null;
  status: number;
};

export type MemberUser = {
  id: number;
  mobile: string | null;
  nickname: string;
  levelId: number | null;
  experience: number;
  point: number;
};

export type ExperienceBizType = {
  type: number;
  title: string;
  description: string;
  add: boolean;
};

export const EXPERIENCE_BIZ_TYPES: ExperienceBizType[] = [
  { type: 0, title: '管理员调整', description: '管理员调整获得 {} 经验', add: true },
  { type: 1, title: '邀新奖励', description: '邀请好友获得 {} 经验', add: true },
  { type: 4, title: '签到奖励', description: '签到获得 {} 经验', add: true },
  { type: 5, title: '抽奖奖励', description: '抽奖获得 {} 经验', add: true },
  { type: 11, title: '下单奖励', description: '下单获得 {} 经验', add: true },
  { type: 12, title: '下单奖励（整单取消）', description: '取消订单获得 {} 经验', add: false },
  { type: 13, title: '下单奖励（单个退款）', description: '退款订单获得 {} 经验', add: false },
];

export function getBizType(type: number): ExperienceBizType | null {
  return EXPERIENCE_BIZ_TYPES.find((item) => item.type === type) ?? null;
}
