import axios from 'axios';

const api = axios.create({
  baseURL: '/api/vpn',
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

export async function fetchRegions(): Promise<Region[]> {
  const res = await api.get<Region[]>('/regions');
  return res.data;
}

export async function fetchActiveInstances(): Promise<InstanceResponse[]> {
  const res = await api.get<InstanceResponse[]>('/instances');
  return res.data;
}

export async function spinUpVpn(payload: SpinUpRequest): Promise<InstanceResponse> {
  const res = await api.post<InstanceResponse>('/spin-up', payload);
  return res.data;
}

export async function fetchInstanceStatus(
  instanceId: string,
  region: string
): Promise<InstanceResponse> {
  const res = await api.get<InstanceResponse>(`/status/${instanceId}`, {
    params: { region },
  });
  return res.data;
}

export async function destroyVpn(
  instanceId: string,
  region: string
): Promise<DestroyResponse> {
  const res = await api.post<DestroyResponse>(`/destroy/${instanceId}`, null, {
    params: { region },
  });
  return res.data;
}
