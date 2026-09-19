import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Progress,
  Space,
  Tag,
  Alert,
  Button,
  Spin,
} from 'antd';
import {
  DollarCircleOutlined,
  CloudServerOutlined,
  GlobalOutlined,
  HddOutlined,
  SwapOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { MonthCostData, CostsData, fetchCostsFromDB } from '../api/vpnClient';

const { Title, Text } = Typography;

const CATEGORIES = [
  { key: 'ec2', label: 'EC2 Compute', color: '#1677ff', icon: <CloudServerOutlined /> },
  { key: 'ip', label: 'In-Use Public IPv4', color: '#fa8c16', icon: <GlobalOutlined /> },
  { key: 'ebs', label: 'EBS gp3 Storage', color: '#13c2c2', icon: <HddOutlined /> },
  { key: 'transfer', label: 'Data Transfer Out', color: '#52c41a', icon: <SwapOutlined /> },
] as const;

export const CostsView: React.FC = () => {
  const [costsData, setCostsData] = useState<CostsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<MonthCostData | null>(null);

  const loadCosts = useCallback(async (showSpin = true) => {
    try {
      if (showSpin) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const data = await fetchCostsFromDB();
      setCostsData(data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to load costs from DynamoDB';
      console.error('Failed to load costs from DynamoDB:', err);
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCosts(true);
  }, [loadCosts]);

  const currentMonth = costsData?.currentMonth || {
    month: new Date().toLocaleString('default', { month: 'short' }),
    ec2: 0.0,
    ip: 0.0,
    ebs: 0.0,
    transfer: 0.0,
  };

  const history = costsData?.history || [];

  const totalCurrent =
    currentMonth.ec2 + currentMonth.ip + currentMonth.ebs + currentMonth.transfer;

  const totalHours = costsData?.totalHours || 0.0;

  // Render history if available; otherwise show current month
  const chartData = history.length > 0 ? history : [currentMonth];

  // Chart dimensions
  const chartHeight = 260;
  const chartWidth = 640;
  const padding = { top: 30, right: 30, bottom: 40, left: 60 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const maxMonthSpend = Math.max(
    ...chartData.map((d) => d.ec2 + d.ip + d.ebs + d.transfer),
    0
  );
  const maxVal = maxMonthSpend > 0 ? Math.max(1.0, Math.ceil(maxMonthSpend * 1.3 * 10) / 10) : 1.0;
  const barWidth = 44;
  const numMonths = chartData.length;
  const stepX = graphWidth / numMonths;

  // Persistent equivalent: 24/7 t3.micro ($7.50) + public IPv4 ($3.60) + 8GB gp3 ($0.80) = ~$11.90/mo
  const persistentBaseline = 11.90;
  const savingsAmount = Math.max(0, persistentBaseline - totalCurrent);
  const savingsPct = Math.min(100, Math.max(0, Math.round(((persistentBaseline - totalCurrent) / persistentBaseline) * 100)));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={2} style={{ color: '#f0f6fc', margin: 0, fontWeight: 600 }}>
            <DollarCircleOutlined style={{ color: '#52c41a', marginRight: 10 }} />
            Cloud Cost & Resource Analytics
          </Title>
          <Text type="secondary">
            DynamoDB-tracked spend across compute, public IP allocations, storage, and egress bandwidth.
          </Text>
        </div>

        <Space>
          <Tag icon={<DatabaseOutlined />} color="purple" style={{ padding: '4px 10px', fontSize: 12 }}>
            DynamoDB Tracked
          </Tag>
          <Button
            icon={<SyncOutlined spin={refreshing} />}
            onClick={() => loadCosts(false)}
            size="middle"
          >
            Refresh Metrics
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          message="DynamoDB Connection Error"
          description={error}
          action={
            <Button size="small" type="primary" danger onClick={() => loadCosts(true)}>
              Retry
            </Button>
          }
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Spin spinning={loading} tip="Querying DynamoDB cost metrics...">
        {/* KPI Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: 12, background: '#161b22', height: '100%' }}>
              <Statistic
                title={<span style={{ color: '#8b949e' }}>Total Spend This Month</span>}
                value={totalCurrent}
                precision={2}
                prefix="$"
                suffix="USD"
                valueStyle={{ color: '#58a6ff', fontWeight: 600 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Current cycle ({currentMonth.month})
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: 12, background: '#161b22', height: '100%' }}>
              <Statistic
                title={<span style={{ color: '#8b949e' }}>Monthly Budget Utilization</span>}
                value={(totalCurrent / 5.0) * 100}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#52c41a', fontWeight: 600 }}
              />
              <Progress
                percent={Math.min(Math.round((totalCurrent / 5.0) * 100), 100)}
                strokeColor="#52c41a"
                showInfo={false}
                size="small"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                ${totalCurrent.toFixed(2)} spent of $5.00 limit
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: 12, background: '#161b22', height: '100%' }}>
              <Statistic
                title={<span style={{ color: '#8b949e' }}>Total Hours Provisioned</span>}
                value={totalHours}
                precision={1}
                suffix="hrs"
                valueStyle={{ color: '#d2a8ff', fontWeight: 600 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tracked in DynamoDB
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: 12, background: '#161b22', height: '100%' }}>
              <Statistic
                title={<span style={{ color: '#8b949e' }}>Effective Hourly Rate</span>}
                value={totalHours > 0 ? totalCurrent / totalHours : 0.021}
                precision={3}
                prefix="$"
                suffix="/hr"
                valueStyle={{ color: '#7ee787', fontWeight: 600 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Compute + IPv4 + EBS amortized
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Cost Breakdown Sections */}
        <Card
          title={
            <Space>
              <InfoCircleOutlined style={{ color: '#1677ff' }} />
              <span>Monthly Cost Breakdown by Component (DynamoDB)</span>
            </Space>
          }
          bordered={false}
          style={{ borderRadius: 12, background: '#161b22', marginBottom: 24 }}
        >
          <Row gutter={[20, 20]}>
            <Col xs={24} md={12} lg={6}>
              <div
                style={{
                  background: '#0d1117',
                  padding: 16,
                  borderRadius: 8,
                  borderLeft: '4px solid #1677ff',
                }}
              >
                <Space style={{ marginBottom: 8 }}>
                  <CloudServerOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                  <Text strong style={{ color: '#f0f6fc' }}>
                    EC2 Compute
                  </Text>
                </Space>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f6fc' }}>
                  ${currentMonth.ec2.toFixed(2)}
                </div>
                <Progress
                  percent={Math.round((currentMonth.ec2 / Math.max(totalCurrent, 0.01)) * 100)}
                  strokeColor="#1677ff"
                  size="small"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  t3.micro on-demand @ $0.0104/hr
                </Text>
              </div>
            </Col>

            <Col xs={24} md={12} lg={6}>
              <div
                style={{
                  background: '#0d1117',
                  padding: 16,
                  borderRadius: 8,
                  borderLeft: '4px solid #fa8c16',
                }}
              >
                <Space style={{ marginBottom: 8 }}>
                  <GlobalOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
                  <Text strong style={{ color: '#f0f6fc' }}>
                    Public IPv4 Address
                  </Text>
                </Space>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f6fc' }}>
                  ${currentMonth.ip.toFixed(2)}
                </div>
                <Progress
                  percent={Math.round((currentMonth.ip / Math.max(totalCurrent, 0.01)) * 100)}
                  strokeColor="#fa8c16"
                  size="small"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  AWS IPv4 fee @ $0.005/hr
                </Text>
              </div>
            </Col>

            <Col xs={24} md={12} lg={6}>
              <div
                style={{
                  background: '#0d1117',
                  padding: 16,
                  borderRadius: 8,
                  borderLeft: '4px solid #13c2c2',
                }}
              >
                <Space style={{ marginBottom: 8 }}>
                  <HddOutlined style={{ color: '#13c2c2', fontSize: 18 }} />
                  <Text strong style={{ color: '#f0f6fc' }}>
                    EBS Storage
                  </Text>
                </Space>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f6fc' }}>
                  ${currentMonth.ebs.toFixed(2)}
                </div>
                <Progress
                  percent={Math.round((currentMonth.ebs / Math.max(totalCurrent, 0.01)) * 100)}
                  strokeColor="#13c2c2"
                  size="small"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  8GB gp3 Root Volume ($0.08/GB-mo)
                </Text>
              </div>
            </Col>

            <Col xs={24} md={12} lg={6}>
              <div
                style={{
                  background: '#0d1117',
                  padding: 16,
                  borderRadius: 8,
                  borderLeft: '4px solid #52c41a',
                }}
              >
                <Space style={{ marginBottom: 8 }}>
                  <SwapOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  <Text strong style={{ color: '#f0f6fc' }}>
                    Data Transfer Out
                  </Text>
                </Space>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f6fc' }}>
                  ${currentMonth.transfer.toFixed(2)}
                </div>
                <Progress
                  percent={Math.round((currentMonth.transfer / Math.max(totalCurrent, 0.01)) * 100)}
                  strokeColor="#52c41a"
                  size="small"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Egress Internet bandwidth ($0.09/GB)
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Stacked Bar Chart */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <span>Historical Monthly Cost (DynamoDB Stacked Breakdown)</span>
              <Space size="middle" wrap>
                {CATEGORIES.map((c) => (
                  <Space key={c.key} size={4}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        backgroundColor: c.color,
                      }}
                    />
                    <Text style={{ fontSize: 12, color: '#8b949e' }}>{c.label}</Text>
                  </Space>
                ))}
              </Space>
            </div>
          }
          bordered={false}
          style={{ borderRadius: 12, background: '#161b22' }}
        >
          <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
                const val = maxVal * ratio;
                const y = padding.top + graphHeight - ratio * graphHeight;
                return (
                  <g key={ratio}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="#30363d"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 12}
                      y={y + 4}
                      textAnchor="end"
                      fill="#8b949e"
                      fontSize="11"
                      fontFamily="monospace"
                    >
                      ${val.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Stacked Bars */}
              {chartData.map((item, idx) => {
                const x = padding.left + idx * stepX + (stepX - barWidth) / 2;
                const totalMonth = item.ec2 + item.ip + item.ebs + item.transfer;

                const hEc2 = (item.ec2 / maxVal) * graphHeight;
                const hIp = (item.ip / maxVal) * graphHeight;
                const hEbs = (item.ebs / maxVal) * graphHeight;
                const hTransfer = (item.transfer / maxVal) * graphHeight;

                const yEc2 = padding.top + graphHeight - hEc2;
                const yIp = yEc2 - hIp;
                const yEbs = yIp - hEbs;
                const yTransfer = yEbs - hTransfer;

                const isHovered = hoveredMonth?.month === item.month;

                return (
                  <g
                    key={item.month}
                    onMouseEnter={() => setHoveredMonth(item)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {isHovered && (
                      <rect
                        x={padding.left + idx * stepX}
                        y={padding.top}
                        width={stepX}
                        height={graphHeight}
                        fill="rgba(255, 255, 255, 0.04)"
                        rx={4}
                      />
                    )}

                    {/* Segment: EC2 */}
                    <rect
                      x={x}
                      y={yEc2}
                      width={barWidth}
                      height={hEc2}
                      fill="#1677ff"
                      rx={idx === 0 || totalMonth === item.ec2 ? 3 : 0}
                      opacity={isHovered ? 1 : 0.85}
                    />

                    {/* Segment: IPv4 */}
                    <rect
                      x={x}
                      y={yIp}
                      width={barWidth}
                      height={hIp}
                      fill="#fa8c16"
                      opacity={isHovered ? 1 : 0.85}
                    />

                    {/* Segment: EBS */}
                    <rect
                      x={x}
                      y={yEbs}
                      width={barWidth}
                      height={hEbs}
                      fill="#13c2c2"
                      opacity={isHovered ? 1 : 0.85}
                    />

                    {/* Segment: Data Transfer */}
                    <rect
                      x={x}
                      y={yTransfer}
                      width={barWidth}
                      height={hTransfer}
                      fill="#52c41a"
                      rx={3}
                      opacity={isHovered ? 1 : 0.85}
                    />

                    {/* Month Label */}
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight - padding.bottom + 20}
                      textAnchor="middle"
                      fill={isHovered ? '#ffffff' : '#8b949e'}
                      fontSize="12"
                      fontWeight={isHovered ? 'bold' : 'normal'}
                    >
                      {item.month}
                    </text>

                    {/* Total Value Above Bar */}
                    <text
                      x={x + barWidth / 2}
                      y={yTransfer - 6}
                      textAnchor="middle"
                      fill="#c9d1d9"
                      fontSize="10"
                      fontWeight={600}
                      fontFamily="monospace"
                    >
                      ${totalMonth.toFixed(2)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Details Card */}
            {hoveredMonth && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 16px',
                  background: '#0d1117',
                  borderRadius: 8,
                  border: '1px solid #30363d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text strong style={{ color: '#58a6ff' }}>
                  {hoveredMonth.month} Details:
                </Text>
                <Space size="large">
                  <Text style={{ fontSize: 13, color: '#c9d1d9' }}>
                    EC2: <strong style={{ color: '#1677ff' }}>${hoveredMonth.ec2.toFixed(2)}</strong>
                  </Text>
                  <Text style={{ fontSize: 13, color: '#c9d1d9' }}>
                    IPv4: <strong style={{ color: '#fa8c16' }}>${hoveredMonth.ip.toFixed(2)}</strong>
                  </Text>
                  <Text style={{ fontSize: 13, color: '#c9d1d9' }}>
                    Storage: <strong style={{ color: '#13c2c2' }}>${hoveredMonth.ebs.toFixed(2)}</strong>
                  </Text>
                  <Text style={{ fontSize: 13, color: '#c9d1d9' }}>
                    Transfer: <strong style={{ color: '#52c41a' }}>${hoveredMonth.transfer.toFixed(2)}</strong>
                  </Text>
                  <Tag color="blue" style={{ fontSize: 13, padding: '2px 8px' }}>
                    Total: ${(
                      hoveredMonth.ec2 +
                      hoveredMonth.ip +
                      hoveredMonth.ebs +
                      hoveredMonth.transfer
                    ).toFixed(2)}
                  </Tag>
                </Space>
              </div>
            )}
          </div>
        </Card>
      </Spin>
    </div>
  );
};
