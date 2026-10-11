import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Typography,
  Space,
  message,
  Row,
  Col,
  Tag,
  Spin,
  Alert,
  Grid,
} from 'antd';
import {
  SettingOutlined,
  ClockCircleOutlined,
  DollarCircleOutlined,
  GlobalOutlined,
  SaveOutlined,
  UndoOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  CloudSyncOutlined,
  MobileOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import {
  Region,
  AppSettings,
  fetchSettingsFromDB,
  saveSettingsToDB,
  getApiKey,
  setApiKey,
} from '../api/vpnClient';

export type { AppSettings };

const { Title, Text, Paragraph } = Typography;

export const DEFAULT_SETTINGS: AppSettings = {
  ttlMinutes: 0,
  monthlyBudget: 5.0,
  budgetAlertEnabled: true,
  defaultRegion: 'ap-southeast-2',
  defaultAllowedIps: '0.0.0.0/0',
  defaultInstanceType: 't3.micro',
};

interface SettingsViewProps {
  regions: Region[];
  onSettingsSaved?: (settings: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ regions, onSettingsSaved }) => {
  const screens = Grid.useBreakpoint();
  const [form] = Form.useForm<AppSettings>();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getApiKey());

  const initSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const dbSettings = await fetchSettingsFromDB();
      setSettings(dbSettings);
      form.setFieldsValue(dbSettings);
      if (dbSettings.updated_at) {
        setLastSyncTime(new Date(dbSettings.updated_at).toLocaleTimeString());
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Could not connect to DynamoDB';
      console.error('Failed to load settings from DynamoDB:', err);
      setError(msg);
      message.error('Failed to load settings from DynamoDB.');
    } finally {
      setLoading(false);
    }
  }, [form]);

  // Fetch settings from DynamoDB on mount
  useEffect(() => {
    initSettings();
  }, [initSettings]);

  const handleFinish = async (values: AppSettings) => {
    try {
      setSaving(true);
      setApiKey(apiKeyInput);
      const saved = await saveSettingsToDB({ ...settings, ...values, ttlMinutes: 0 });
      setSettings(saved);
      setLastSyncTime(new Date().toLocaleTimeString());
      message.success('Settings and API credentials saved successfully!');
      if (onSettingsSaved) {
        onSettingsSaved(saved);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'DynamoDB save failed';
      console.error('Save to DynamoDB failed:', e);
      message.error(`Failed to save to DynamoDB: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      const saved = await saveSettingsToDB(DEFAULT_SETTINGS);
      setSettings(saved);
      form.setFieldsValue(saved);
      setLastSyncTime(new Date().toLocaleTimeString());
      message.info('Reset to defaults and synced to DynamoDB.');
      if (onSettingsSaved) {
        onSettingsSaved(saved);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'DynamoDB reset failed';
      console.error('Reset in DynamoDB failed:', e);
      message.error(`Failed to reset settings in DynamoDB: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title
            level={screens.xs ? 3 : 2}
            style={{
              color: '#f0f6fc',
              margin: 0,
              fontWeight: 600,
              fontSize: screens.xs ? 20 : 26,
            }}
          >
            <SettingOutlined style={{ color: '#fa8c16', marginRight: 10 }} />
            System Preferences & Automation
          </Title>
          <Text type="secondary" style={{ fontSize: screens.xs ? 12 : 14 }}>
            Configure spending budgets, default regions, and deployment presets.
          </Text>
        </div>

        <Space wrap size={[8, 8]}>
          <Tag icon={<DatabaseOutlined />} color="purple" style={{ padding: '4px 10px', fontSize: 12, margin: 0 }}>
            DynamoDB: <code>aws_global_router_parameters</code>
          </Tag>
          {lastSyncTime && (
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ padding: '4px 10px', fontSize: 12, margin: 0 }}>
              Synced {lastSyncTime}
            </Tag>
          )}
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          message="DynamoDB Error"
          description={error}
          action={
            <Button size="small" type="primary" danger onClick={initSettings}>
              Retry Connection
            </Button>
          }
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Spin spinning={loading} tip="Loading parameters from DynamoDB...">
        <Form
          form={form}
          layout="vertical"
          initialValues={settings || DEFAULT_SETTINGS}
          onFinish={handleFinish}
        >
          <Row gutter={[24, 24]}>
            {/* Budget & Cost Alerts */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <DollarCircleOutlined style={{ color: '#52c41a' }} />
                    <span>Cloud Budget & Spending Guardrails</span>
                  </Space>
                }
                bordered={false}
                style={{ borderRadius: 12, background: '#161b22' }}
              >
                <Row gutter={24} align="middle">
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="monthlyBudget"
                      label="Monthly Budget Ceiling ($ USD)"
                      tooltip="Desired monthly cap for EC2 and WireGuard usage."
                    >
                      <InputNumber
                        min={1}
                        max={100}
                        precision={2}
                        prefix="$"
                        size="large"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="budgetAlertEnabled"
                      label="Budget Warnings"
                      valuePropName="checked"
                    >
                      <Space direction="vertical" size={2}>
                        <Switch defaultChecked />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Alert when monthly spend reaches 80% of target budget.
                        </Text>
                      </Space>
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Deployment Defaults */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <GlobalOutlined style={{ color: '#fa8c16' }} />
                    <span>Deployment Presets</span>
                  </Space>
                }
                bordered={false}
                style={{ borderRadius: 12, background: '#161b22' }}
              >
                <Row gutter={24}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="defaultRegion"
                      label="Default AWS Region"
                      tooltip="Pre-selected region in the provisioning dropdown."
                    >
                      <Select
                        showSearch
                        size="large"
                        options={regions.map((r) => ({
                          value: r.id,
                          label: `${r.name} (${r.id})`,
                        }))}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="defaultInstanceType"
                      label="Default EC2 Instance Type"
                    >
                      <Select
                        size="large"
                        options={[
                          { value: 't3.micro', label: 't3.micro (x86_64, Free-tier eligible)' }
                        ]}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Form.Item
                      name="defaultAllowedIps"
                      label="Default Split-Tunnel Routing (AllowedIPs)"
                      tooltip="Default CIDR range injected into new WireGuard client configurations."
                    >
                      <Input size="large" placeholder="0.0.0.0/0" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Control Plane API Security */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <KeyOutlined style={{ color: '#faad14' }} />
                    <span>Control Plane API Security</span>
                  </Space>
                }
                bordered={false}
                style={{ borderRadius: 12, background: '#161b22' }}
              >
                <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
                  If <code>VPN_API_KEY</code> is configured on your backend, enter your API key below. It will be passed via the <code>X-API-Key</code> header for all control plane operations (launch, pause, resume, device management) and stored securely in your browser's local storage.
                </Paragraph>

                <Row gutter={24} align="middle">
                  <Col xs={24} md={18}>
                    <Form.Item
                      label="API Secret Key (VPN_API_KEY)"
                      tooltip="Must match the VPN_API_KEY environment variable set on the backend."
                      style={{ marginBottom: screens.xs ? 12 : 0 }}
                    >
                      <Input.Password
                        size="large"
                        placeholder="Enter your VPN_API_KEY"
                        value={apiKeyInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setApiKeyInput(val);
                          setApiKey(val);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Button
                      type={apiKeyInput ? 'primary' : 'default'}
                      size="large"
                      style={{ width: '100%', marginTop: screens.xs ? 0 : 30 }}
                      onClick={() => {
                        setApiKey(apiKeyInput);
                        message.success('API key saved to browser session!');
                      }}
                    >
                      Save Key
                    </Button>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Dynamic DNS, API Security & Warm Standby Info */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <SafetyCertificateOutlined style={{ color: '#13c2c2' }} />
                    <span>v1.2.0 Architecture & Security Profile</span>
                  </Space>
                }
                bordered={false}
                style={{ borderRadius: 12, background: '#161b22' }}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <div style={{ background: '#0d1117', padding: 14, borderRadius: 8, border: '1px solid #30363d' }}>
                      <Space align="center" style={{ marginBottom: 6 }}>
                        <CloudSyncOutlined style={{ color: '#52c41a' }} />
                        <Text strong style={{ color: '#f0f6fc' }}>Anonymous DuckDNS Dynamic Host</Text>
                      </Space>
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                        Permanent WireGuard endpoint mapping via <code>DUCKDNS_DOMAIN</code> and <code>DUCKDNS_TOKEN</code>. Public IP updates dynamically sync on EC2 boot without invalidating client configurations or revealing personal WHOIS records.
                      </Paragraph>
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ background: '#0d1117', padding: 14, borderRadius: 8, border: '1px solid #30363d' }}>
                      <Space align="center" style={{ marginBottom: 6 }}>
                        <SafetyCertificateOutlined style={{ color: '#1677ff' }} />
                        <Text strong style={{ color: '#f0f6fc' }}>Hardened REST Control Plane</Text>
                      </Space>
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                        Mutating endpoints (<code>/spin-up</code>, <code>/start</code>, <code>/stop</code>, <code>/devices/*</code>) require header authentication with <code>X-API-Key</code> matching <code>VPN_API_KEY</code>. Unauthorized calls are blocked with <code>401 Unauthorized</code>.
                      </Paragraph>
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ background: '#0d1117', padding: 14, borderRadius: 8, border: '1px solid #30363d' }}>
                      <Space align="center" style={{ marginBottom: 6 }}>
                        <MobileOutlined style={{ color: '#fa8c16' }} />
                        <Text strong style={{ color: '#f0f6fc' }}>Multi-Device Mesh Allocation</Text>
                      </Space>
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                        Supports up to 5 concurrent devices per node (<code>10.8.0.2</code> to <code>10.8.0.6</code>) with individual keypairs and independent config downloads via the QR code modal.
                      </Paragraph>
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ background: '#0d1117', padding: 14, borderRadius: 8, border: '1px solid #30363d' }}>
                      <Space align="center" style={{ marginBottom: 6 }}>
                        <ClockCircleOutlined style={{ color: '#eb2f96' }} />
                        <Text strong style={{ color: '#f0f6fc' }}>Warm Standby (Zero-Cost Idle)</Text>
                      </Space>
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                        Pause (stop) instances to release AWS public IPv4 addresses and halt compute charges while keeping disk state for instant 10–15 second resumption.
                      </Paragraph>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              flexDirection: screens.xs ? 'column-reverse' : 'row',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            <Button
              icon={<UndoOutlined />}
              onClick={handleReset}
              size="large"
              disabled={saving}
              block={screens.xs}
            >
              Reset Defaults
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              htmlType="submit"
              size="large"
              loading={saving}
              block={screens.xs}
              style={{ minWidth: screens.xs ? undefined : 160, fontWeight: 600 }}
            >
              Save to DynamoDB
            </Button>
          </div>
        </Form>
      </Spin>
    </div>
  );
};
