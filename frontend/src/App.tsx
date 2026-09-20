import React, { useEffect, useState, useCallback } from 'react';
import {
  Layout,
  Typography,
  Space,
  Row,
  Col,
  message,
  Tag,
  Button,
  Grid,
} from 'antd';
import {
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import {
  fetchRegions,
  fetchActiveInstances,
  fetchSettingsFromDB,
  spinUpVpn,
  fetchInstanceStatus,
  destroyVpn,
  Region,
  InstanceResponse,
  SpinUpRequest,
} from './api/vpnClient';
import { SideNavBar, PageKey } from './components/SideNavBar';
import { RegionSelect } from './components/RegionSelect';
import { StatusCard } from './components/StatusCard';
import { QRCodeModal } from './components/QRCodeModal';
import { CostsView } from './components/CostsView';
import { SettingsView, AppSettings, DEFAULT_SETTINGS } from './components/SettingsView';
import { AppFooter } from './components/AppFooter';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export const App: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const [currentTab, setCurrentTab] = useState<PageKey>('home');
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [regions, setRegions] = useState<Region[]>([]);
  const [loadingRegions, setLoadingRegions] = useState<boolean>(true);
  const [isSpinningUp, setIsSpinningUp] = useState<boolean>(false);
  const [activeInstances, setActiveInstances] = useState<InstanceResponse[]>([]);
  const [destroyingId, setDestroyingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedQrInstance, setSelectedQrInstance] = useState<InstanceResponse | null>(null);

  // Load regions, settings from DynamoDB, and existing active instances on mount
  useEffect(() => {
    async function initData() {
      try {
        setLoadingRegions(true);
        const [regionData, instanceData, dbSettings] = await Promise.all([
          fetchRegions(),
          fetchActiveInstances(),
          fetchSettingsFromDB(),
        ]);
        setRegions(regionData);
        setActiveInstances(instanceData);
        if (dbSettings) {
          setSettings(dbSettings);
        }
      } catch (err) {
        console.error('Initialization failed:', err);
        message.error('Could not connect to backend control plane.');
      } finally {
        setLoadingRegions(false);
      }
    }
    initData();
  }, []);

  // Poll instances that are still bootstrapping
  useEffect(() => {
    const hasBootstrapping = activeInstances.some(
      (inst) => inst.state.toLowerCase() !== 'running' && inst.state.toLowerCase() !== 'terminated'
    );
    if (!hasBootstrapping) return;

    const interval = setInterval(async () => {
      try {
        const updatedList = await Promise.all(
          activeInstances.map(async (inst) => {
            if (inst.state.toLowerCase() === 'running') return inst;
            try {
              return await fetchInstanceStatus(inst.instance_id, inst.region);
            } catch {
              return inst;
            }
          })
        );
        setActiveInstances(updatedList);
      } catch (err) {
        console.warn('Status poll warning:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeInstances]);

  const handleSpinUp = async (req: SpinUpRequest) => {
    try {
      setIsSpinningUp(true);
      const res = await spinUpVpn(req);
      setActiveInstances((prev) => [...prev, res]);
      message.success(`Provisioning WireGuard node in ${req.region}...`);
    } catch (err: any) {
      console.error('Spin-up failed:', err);
      message.error(err?.response?.data?.detail || 'Failed to spin up VPN node.');
    } finally {
      setIsSpinningUp(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const list = await fetchActiveInstances();
      setActiveInstances(list);
      message.success('Instances refreshed.');
    } catch (err) {
      console.error('Refresh failed:', err);
      message.error('Failed to refresh instances.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleDestroy = async (inst: InstanceResponse) => {
    try {
      setDestroyingId(inst.instance_id);
      await destroyVpn(inst.instance_id, inst.region);
      message.info(`VPN instance ${inst.instance_id} destroyed.`);
      setActiveInstances((prev) => prev.filter((i) => i.instance_id !== inst.instance_id));
      if (selectedQrInstance?.instance_id === inst.instance_id) {
        setSelectedQrInstance(null);
      }
    } catch (err: any) {
      console.error('Termination failed:', err);
      message.error(err?.response?.data?.detail || 'Failed to destroy VPN instance.');
    } finally {
      setDestroyingId(null);
    }
  };

  const runningCount = activeInstances.filter((i) => i.state.toLowerCase() === 'running').length;

  return (
    <Layout style={{ minHeight: '100vh', background: '#090d13' }}>
      {/* Side Navigation Bar (Collapsible Sider on Desktop, Slide-in Drawer on Mobile) */}
      <SideNavBar
        currentKey={currentTab}
        onSelectKey={(k) => setCurrentTab(k)}
        collapsed={collapsed}
        onCollapse={(c) => setCollapsed(c)}
        mobileOpen={mobileDrawerOpen}
        onMobileClose={() => setMobileDrawerOpen(false)}
      />

      <Layout style={{ background: 'transparent', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top Header Bar */}
        <Header
          style={{
            background: '#161b22',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: screens.xs ? '0 12px' : '0 24px',
            height: 64,
          }}
        >
          <Space direction="horizontal" size="small" align="center">
            {/* Mobile Hamburger Drawer Trigger */}
            {!screens.lg && (
              <Button
                type="text"
                icon={<MenuOutlined style={{ fontSize: 20, color: '#f0f6fc' }} />}
                onClick={() => setMobileDrawerOpen(true)}
                style={{ padding: '4px 8px', marginRight: 2 }}
                aria-label="Toggle Navigation Menu"
              />
            )}
            <SafetyCertificateOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title
              level={4}
              style={{
                margin: 0,
                color: '#f0f6fc',
                fontWeight: 600,
                fontSize: screens.xs ? 15 : 18,
                whiteSpace: 'nowrap',
              }}
            >
              {currentTab === 'home' && (screens.xs ? 'AWS Router' : 'AWS Global Router')}
              {currentTab === 'costs' && (screens.xs ? 'Costs & Spending' : 'Cost & Spending Intelligence')}
              {currentTab === 'settings' && (screens.xs ? 'Settings' : 'Platform Settings')}
            </Title>
          </Space>

          <Space direction="horizontal" size="middle" align="center">
            {runningCount > 0 ? (
              <Tag color="success" icon={<ThunderboltOutlined />} style={{ margin: 0 }}>
                {screens.xs ? `${runningCount} ACTIVE` : `${runningCount} TUNNEL${runningCount > 1 ? 'S' : ''} ACTIVE`}
              </Tag>
            ) : (
              <Tag color="default" style={{ margin: 0 }}>
                {screens.xs ? 'STANDBY' : 'STANDBY (0 RUNNING)'}
              </Tag>
            )}
            <Text
              style={{
                color: '#8b949e',
                fontSize: 13,
                display: screens.md ? 'inline' : 'none',
              }}
            >
              Ephemeral WireGuard Orchestrator
            </Text>
          </Space>
        </Header>

        {/* Content Area */}
        <Content
          style={{
            padding: screens.xs ? '16px 12px' : '32px 28px',
            maxWidth: 1200,
            margin: '0 auto',
            width: '100%',
            flex: 1,
          }}
        >
          {currentTab === 'home' && (
            <>
              {/* Two side-by-side columns: Left is Create VPN, Right is Active VPNs */}
              <Row gutter={[24, 24]} align="stretch">
                <Col xs={24} lg={12}>
                  <RegionSelect
                    regions={regions}
                    loadingRegions={loadingRegions}
                    isSpinningUp={isSpinningUp}
                    onSpinUp={handleSpinUp}
                    defaultRegion={settings.defaultRegion}
                    defaultAllowedIps={settings.defaultAllowedIps}
                    defaultInstanceType={settings.defaultInstanceType}
                    defaultTtlMinutes={settings.ttlMinutes}
                  />
                </Col>

                <Col xs={24} lg={12}>
                  <StatusCard
                    instances={activeInstances}
                    regions={regions}
                    onOpenQR={(inst) => setSelectedQrInstance(inst)}
                    onDestroy={handleDestroy}
                    destroyingId={destroyingId}
                    onRefresh={handleRefresh}
                    isRefreshing={isRefreshing}
                  />
                </Col>
              </Row>

              {selectedQrInstance && (
                <QRCodeModal
                  visible={!!selectedQrInstance}
                  onClose={() => setSelectedQrInstance(null)}
                  configText={selectedQrInstance.client_config || 'Bootstrapping client configuration...'}
                  region={selectedQrInstance.region}
                  instanceId={selectedQrInstance.instance_id}
                />
              )}
            </>
          )}

          {currentTab === 'costs' && <CostsView />}

          {currentTab === 'settings' && (
            <SettingsView
              regions={regions}
              onSettingsSaved={(newSettings) => setSettings(newSettings)}
            />
          )}
        </Content>

        {/* Footer */}
        <AppFooter />
      </Layout>
    </Layout>
  );
};
