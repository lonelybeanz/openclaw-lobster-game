export type KpiData = {
  totalMeters: number;
  onlineMeters: number;
  todayUsage: number;
  anomalies: number;
  collectSuccessRate: number;
};

export type TrendPoint = {
  time: string;
  usage: number;
  pressure: number;
};

export type RegionUsage = {
  region: string;
  usage: number;
};

export type DeviceStatus = {
  name: string;
  value: number;
};

export type MapPoint = {
  id: string;
  name: string;
  x: number;
  y: number;
  usage: number;
  status: 'normal' | 'warning' | 'offline';
};

export type AlertEvent = {
  id: string;
  time: string;
  title: string;
  level: 'low' | 'medium' | 'high';
};

export type DashboardData = {
  kpi: KpiData;
  trend: TrendPoint[];
  regionUsage: RegionUsage[];
  deviceStatus: DeviceStatus[];
  mapPoints: MapPoint[];
  alerts: AlertEvent[];
};
