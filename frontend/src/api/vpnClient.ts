import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Region {
  id: string;
  name: string;
}

export interface SpinUpRequest {
  region: string;
  instance_type?: string;
  allowed_ips?: string;
  ttl_minutes?: number;
}

export interface InstanceResponse {
  instance_id: string;
  region: string;
  state: 'pending' | 'running' | 'shutting-down' | 'terminated' | 'stopping' | 'stopped' | string;
  public_ip?: string | null;
  instance_type?: string;
  launch_time?: string;
  client_config?: string;
  ttl_minutes?: number | null;
}

export interface DestroyResponse {
  instance_id: string;
  region: string;
  state: string;
  message: string;
}

export interface AppSettings {
  ttlMinutes: number;
  monthlyBudget: number;
  budgetAlertEnabled: boolean;
  defaultRegion: string;
  defaultAllowedIps: string;
  defaultInstanceType: string;
  updated_at?: string;
}

export interface MonthCostData {
  month: string;
  ec2: number;
  ip: number;
  ebs: number;
  transfer: number;
}

export interface CostsData {
  currentMonth: MonthCostData;
  history: MonthCostData[];
  totalHours: number;
  updated_at?: string;
  last_terminated_instance?: {
    instance_id: string;
    region: string;
    hours: number;
    recorded_at: string;
  };
}

// ----------------------------------------------------------------------
// VPN Orchestration Endpoints
// ----------------------------------------------------------------------

export async function fetchRegions(): Promise<Region[]> {
  const res = await api.get<Region[]>('/vpn/regions');
  return res.data;
}

export async function fetchActiveInstances(): Promise<InstanceResponse[]> {
  const res = await api.get<InstanceResponse[]>('/vpn/instances');
  return res.data;
}

export async function spinUpVpn(payload: SpinUpRequest): Promise<InstanceResponse> {
  const res = await api.post<InstanceResponse>('/vpn/spin-up', payload);
  return res.data;
}

export async function fetchInstanceStatus(
  instanceId: string,
  region: string
): Promise<InstanceResponse> {
  const res = await api.get<InstanceResponse>(`/vpn/status/${instanceId}`, {
    params: { region },
  });
  return res.data;
}

export async function destroyVpn(
  instanceId: string,
  region: string
): Promise<DestroyResponse> {
  const res = await api.post<DestroyResponse>(`/vpn/destroy/${instanceId}`, null, {
    params: { region },
  });
  return res.data;
}

// ----------------------------------------------------------------------
// DynamoDB Parameter Endpoints
// ----------------------------------------------------------------------

export async function fetchSettingsFromDB(): Promise<AppSettings> {
  const res = await api.get<AppSettings>('/parameters/settings');
  return res.data;
}

export async function saveSettingsToDB(settings: AppSettings): Promise<AppSettings> {
  const res = await api.post<AppSettings>('/parameters/settings', settings);
  return res.data;
}

export async function fetchCostsFromDB(): Promise<CostsData> {
  const res = await api.get<CostsData>('/parameters/costs');
  return res.data;
}

export async function updateCostsInDB(data: Partial<CostsData>): Promise<CostsData> {
  const res = await api.post<CostsData>('/parameters/costs', data);
  return res.data;
}

export async function fetchParametersList(): Promise<string[]> {
  const res = await api.get<string[]>('/parameters/list');
  return res.data;
}
