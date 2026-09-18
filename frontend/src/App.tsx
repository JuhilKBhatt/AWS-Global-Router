import React, { useEffect, useState, useCallback } from 'react';
import {
  Layout,
  Typography,
  Space,
  Alert,
  Row,
  Col,
  message,
  Divider,
} from 'antd';
import {
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import {
  fetchRegions,
  spinUpVpn,
  fetchInstanceStatus,
  destroyVpn,
  Region,
  InstanceResponse,
  SpinUpRequest,
} from './api/vpnClient';
import { RegionSelect } from './components/RegionSelect';
import { StatusCard } from './components/StatusCard';
import { QRCodeModal } from './components/QRCodeModal';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

export const App: React.FC = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loadingRegions, setLoadingRegions] = useState<boolean>(true);
  const [isSpinningUp, setIsSpinningUp] = useState<boolean>(false);
  const [activeInstance, setActiveInstance] = useState<InstanceResponse | null>(null);
  const [isDestroying, setIsDestroying] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);

  // Load regions on mount
  useEffect(() => {
    async function loadRegions() {
      try {
        setLoadingRegions(true);
        const data = await fetchRegions();
        setRegions(data);
      } catch (err) {
        console.error('Failed to load regions:', err);
        message.error('Unable to fetch AWS regions from backend.');
      } finally {
        setLoadingRegions(false);
      }
    }
    loadRegions();
  }, []);

  // Poll instance status if pending
  useEffect(() => {
    if (!activeInstance || activeInstance.state === 'running' || activeInstance.state === 'terminated') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await fetchInstanceStatus(activeInstance.instance_id, activeInstance.region);
        setActiveInstance(updated);
        if (updated.state === 'running') {
          message.success('VPN instance is now live and ready to connect!');
        }
      } catch (err) {
        console.warn('Status poll warning:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeInstance]);

  const handleSpinUp = async (req: SpinUpRequest) => {
    try {
      setIsSpinningUp(true);
      const res = await spinUpVpn(req);
      setActiveInstance(res);
      message.success(`Spinning up EC2 node in ${req.region}...`);
    } catch (err: any) {
      console.error('Spin-up failed:', err);
      message.error(err?.response?.data?.detail || 'Failed to spin up VPN node.');
    } finally {
      setIsSpinningUp(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!activeInstance) return;
    try {
      setIsRefreshing(true);
      const updated = await fetchInstanceStatus(activeInstance.instance_id, activeInstance.region);
      setActiveInstance(updated);
    } catch (err) {
      console.error('Refresh failed:', err);
      message.error('Failed to refresh status.');
    } finally {
      setIsRefreshing(false);
    }
  }, [activeInstance]);

  const handleDestroy = async () => {
    if (!activeInstance) return;
    try {
      setIsDestroying(true);
      await destroyVpn(activeInstance.instance_id, activeInstance.region);
      message.info(`VPN instance ${activeInstance.instance_id} terminated.`);
      setActiveInstance(null);
    } catch (err: any) {
      console.error('Termination failed:', err);
      message.error(err?.response?.data?.detail || 'Failed to destroy VPN instance.');
    } finally {
      setIsDestroying(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#0f141c' }}>
      <Header
        style={{
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <Space direction="horizontal" size="middle">
          <SafetyCertificateOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0, color: '#f0f6fc', fontWeight: 600 }}>
            AWS Global Router
          </Title>
        </Space>
        <Space direction="horizontal" size="small">
          <ThunderboltOutlined style={{ color: '#52c41a' }} />
          <Text style={{ color: '#8b949e', fontSize: 13 }}>On-Demand Ephemeral VPN</Text>
        </Space>
      </Header>

      <Content style={{ padding: '32px 24px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        <Alert
          message="Cost & Ephemerality Reminder"
          description="Ephemeral nodes cost ~$0.015/hr. When you are finished with your session, destroy the endpoint to release the instance and avoid recurring IPv4 and compute fees."
          type="info"
          showIcon
          icon={<CloudUploadOutlined />}
          style={{ marginBottom: 24, borderRadius: 8, background: '#162233', border: '1px solid #1f3a5f' }}
        />

        <Row gutter={[24, 24]}>
          <Col xs={24}>
            <RegionSelect
              regions={regions}
              loadingRegions={loadingRegions}
              isSpinningUp={isSpinningUp}
              onSpinUp={handleSpinUp}
              disabled={!!activeInstance && activeInstance.state !== 'terminated'}
            />
          </Col>

          {activeInstance && (
            <Col xs={24}>
              <StatusCard
                instance={activeInstance}
                onOpenQR={() => setQrModalOpen(true)}
                onDestroy={handleDestroy}
                isDestroying={isDestroying}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
              />
            </Col>
          )}
        </Row>

        {activeInstance && (
          <QRCodeModal
            visible={qrModalOpen}
            onClose={() => setQrModalOpen(false)}
            configText={activeInstance.client_config || 'Bootstrapping client configuration...'}
            region={activeInstance.region}
          />
        )}
      </Content>

      <Footer style={{ textAlign: 'center', background: 'transparent', color: '#6e7681' }}>
        <Divider style={{ borderColor: '#21262d', margin: '16px 0' }} />
        AWS Global Router © {new Date().getFullYear()} — Built with FastAPI, React, Vite & WireGuard
      </Footer>
    </Layout>
  );
};
