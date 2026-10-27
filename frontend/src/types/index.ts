export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'engineer' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SensorThresholds {
  temp_warn?: number;
  temp_crit?: number;
  vib_warn?: number;
  vib_crit?: number;
  press_min?: number;
  press_max?: number;
  current_max?: number;
  rpm_min?: number;
  rpm_max?: number;
}

export interface Equipment {
  id: number;
  equipment_code: string;
  name: string;
  equipment_type: string;
  location: string;
  description?: string;
  operational_status: 'operational' | 'warning' | 'critical' | 'maintenance' | 'offline';
  installation_date?: string;
  sensor_thresholds?: SensorThresholds;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  active_alerts_count?: number;
  health_score?: number;
  health_category?: string;
  latest_telemetry_timestamp?: string;
}

export interface Telemetry {
  id: number;
  equipment_id: number;
  timestamp: string;
  temperature: number;
  vibration: number;
  pressure: number;
  motor_current: number;
  speed_rpm?: number;
  sensor_quality: 'good' | 'suspect' | 'bad' | 'offline';
  metadata_json?: Record<string, any>;
  is_anomaly: boolean;
  anomaly_score?: number;
}

export interface Alert {
  id: number;
  equipment_id: number;
  alert_type: 'threshold_violation' | 'ml_anomaly' | 'stale_telemetry' | 'rapid_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  triggering_measurement?: {
    metric?: string;
    value?: number;
    unit?: string;
    threshold?: number;
    [key: string]: any;
  };
  detection_reason?: string;
  status: 'open' | 'acknowledged' | 'resolved';
  cooldown_key?: string;
  timestamp: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

export interface AlertRule {
  id: number;
  equipment_id?: number;
  rule_name: string;
  metric: string;
  condition_type: string;
  warning_threshold?: number;
  critical_threshold?: number;
  min_range?: number;
  max_range?: number;
  cooldown_seconds: number;
  is_enabled: boolean;
  created_at: string;
}

export interface MaintenanceRecord {
  id: number;
  equipment_id: number;
  title: string;
  description?: string;
  maintenance_type: 'preventive' | 'corrective' | 'inspection' | 'emergency' | 'calibration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_date: string;
  completion_date?: string;
  assigned_technician?: string;
  work_performed?: string;
  parts_used?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ContributingFactor {
  factor: string;
  impact: 'negative' | 'neutral' | 'positive';
  penalty_points: number;
  detail: string;
}

export interface HealthAssessment {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  health_score: number;
  health_category: string;
  telemetry_status: string;
  latest_telemetry_timestamp?: string;
  minutes_since_last_reading?: number;
  contributing_factors: ContributingFactor[];
  active_warning_conditions: string[];
  assessment_explanation: string;
  methodology_note: string;
}

export interface MeasuredEvidence {
  metric: string;
  latest_value: any;
  unit: string;
  threshold?: string;
  status: string;
  historical_context?: string;
}

export interface DiagnosticCheck {
  check_name: string;
  subsystem: string;
  procedure: string;
  priority: string;
}

export interface DiagnosticReport {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  generated_at: string;
  engine_used: string;
  observations_summary: string;
  measured_evidence: MeasuredEvidence[];
  possible_causes: string[];
  suggested_checks: DiagnosticCheck[];
  recommended_actions: string[];
  uncertainty_and_limitations: string;
  risk_level: string;
}

export interface SimulatorStatus {
  is_running: boolean;
  equipment_id?: number;
  equipment_code?: string;
  scenario?: string;
  interval_seconds: number;
  readings_generated: number;
  current_step: number;
  last_reading_time?: string;
  status_message: string;
}

export interface DashboardKPIs {
  total_equipment: number;
  healthy_equipment: number;
  attention_equipment: number;
  critical_equipment: number;
  active_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  upcoming_maintenance: number;
  overdue_maintenance: number;
  completed_maintenance_window: number;
  system_mean_health: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  health_distribution: Record<string, number>;
  telemetry_trends: Array<{
    time: string;
    avg_temp: number;
    avg_vib: number;
    avg_press: number;
    avg_curr: number;
  }>;
  latest_alerts: Array<{
    id: number;
    equipment_id: number;
    title: string;
    severity: string;
    alert_type: string;
    status: string;
    timestamp: string;
  }>;
}
