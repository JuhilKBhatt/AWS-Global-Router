import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Slider,
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
} from '@ant-design/icons';
import {
  Region,
  AppSettings,
  fetchSettingsFromDB,
  saveSettingsToDB,
} from '../api/vpnClient';

export type { AppSettings };

const { Title, Text, Paragraph } = Typography;

export const DEFAULT_SETTINGS: AppSettings = {
  ttlMinutes: 60,
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
  const [form] = Form.useForm<AppSettings>();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

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
      const saved = await saveSettingsToDB(values);
      setSettings(saved);
      setLastSyncTime(new Date().toLocaleTimeString());
      message.success('Settings successfully saved to AWS DynamoDB!');
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
          <Title level={2} style={{ color: '#f0f6fc', margin: 0, fontWeight: 600 }}>
            <SettingOutlined style={{ color: '#fa8c16', marginRight: 10 }} />
            System Preferences & Automation
          </Title>
          <Text type="secondary">
            Configure idle session auto-teardown, spending budgets, and deployment defaults.
          </Text>
        </div>

        <Space>
          <Tag icon={<DatabaseOutlined />} color="purple" style={{ padding: '4px 10px', fontSize: 12 }}>
            DynamoDB: <code>aws_global_router_parameters</code>
          </Tag>
          {lastSyncTime && (
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ padding: '4px 10px', fontSize: 12 }}>
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
            {/* Lifecycle & TTL */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <ClockCircleOutlined style={{ color: '#1677ff' }} />
                    <span>Ephemeral Lifecycle & Auto-Teardown TTL</span>
                  </Space>
                }
                bordered={false}
                style={{ borderRadius: 12, background: '#161b22' }}
              >
                <Paragraph type="secondary" style={{ fontSize: 13 }}>
                  Automatically terminate active EC2 instances after an elapsed time to protect against
                  forgotten sessions and recurring IPv4 compute billing.
                </Paragraph>

                <Form.Item
                  name="ttlMinutes"
                  label="Maximum Session Lifetime (TTL in Minutes)"
                  tooltip="Set to 0 to disable automated teardown."
                >
                  <Slider
                    min={15}
                    max={240}
                    step={15}
                    marks={{
                      15: '15m',
                      30: '30m',
                      60: '1h (Recommended)',
                      120: '2h',
                      180: '3h',
                      240: '4h',
                    }}
                  />
                </Form.Item>
              </Card>
            </Col>

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
                          { value: 't3.micro', label: 't3.micro (x86_64, Free-tier eligible)' },
                          { value: 't4g.micro', label: 't4g.micro (Graviton ARM, 20% cheaper)' },
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
          </Row>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button icon={<UndoOutlined />} onClick={handleReset} size="large" disabled={saving}>
              Reset Defaults
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              htmlType="submit"
              size="large"
              loading={saving}
              style={{ minWidth: 160, fontWeight: 600 }}
            >
              Save to DynamoDB
            </Button>
          </div>
        </Form>
      </Spin>
    </div>
  );
};
