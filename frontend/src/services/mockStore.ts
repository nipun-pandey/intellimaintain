import {
  Equipment,
  Telemetry,
  Alert,
  MaintenanceRecord,
  HealthAssessment,
  DiagnosticReport,
  SimulatorStatus,
  DashboardData,
  User,
} from '../types';
import {
  INITIAL_EQUIPMENT,
  INITIAL_ALERTS,
  INITIAL_MAINTENANCE,
  generateInitialTelemetry,
} from './mockData';

class ClientMockStore {
  private equipment: Equipment[] = [];
  private alerts: Alert[] = [];
  private maintenance: MaintenanceRecord[] = [];
  private telemetryMap: Map<number, Telemetry[]> = new Map();
  private simStatus: SimulatorStatus = {
    is_running: false,
    interval_seconds: 2.0,
    readings_generated: 0,
    current_step: 0,
    status_message: 'Idle',
  };
  private simIntervalTimer: any = null;
  private simRecentReadings: any[] = [];

  constructor() {
    this.init();
  }

  private init() {
    const savedEq = localStorage.getItem('mock_equipment');
    this.equipment = savedEq ? JSON.parse(savedEq) : [...INITIAL_EQUIPMENT];

    const savedAlerts = localStorage.getItem('mock_alerts');
    this.alerts = savedAlerts ? JSON.parse(savedAlerts) : [...INITIAL_ALERTS];

    const savedMaint = localStorage.getItem('mock_maint');
    this.maintenance = savedMaint ? JSON.parse(savedMaint) : [...INITIAL_MAINTENANCE];

    this.equipment.forEach((eq) => {
      this.telemetryMap.set(eq.id, generateInitialTelemetry(eq.id, 40));
    });
  }

  private persist() {
    localStorage.setItem('mock_equipment', JSON.stringify(this.equipment));
    localStorage.setItem('mock_alerts', JSON.stringify(this.alerts));
    localStorage.setItem('mock_maint', JSON.stringify(this.maintenance));
  }

  // --- Auth ---
  login(username: string): { access_token: string; token_type: string; user: User } {
    let role: 'admin' | 'engineer' | 'viewer' = 'engineer';
    let fullName = 'Marcus Kane (Reliability Engineer)';

    if (username.toLowerCase().includes('admin')) {
      role = 'admin';
      fullName = 'Eleanor Vance (Plant Admin)';
    } else if (username.toLowerCase().includes('viewer')) {
      role = 'viewer';
      fullName = 'Sarah Lin (Operations Viewer)';
    }

    const user: User = {
      id: role === 'admin' ? 1 : role === 'engineer' ? 2 : 3,
      email: username || 'engineer@intellimaintain.io',
      full_name: fullName,
      role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      access_token: 'mock-jwt-token-preview-' + Date.now(),
      token_type: 'bearer',
      user,
    };
  }

  getCurrentUser(): User {
    const saved = localStorage.getItem('user');
    if (saved) return JSON.parse(saved);
    return {
      id: 2,
      email: 'engineer@intellimaintain.io',
      full_name: 'Marcus Kane (Reliability Engineer)',
      role: 'engineer',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // --- Equipment ---
  listEquipment(params?: { search?: string; equipment_type?: string; operational_status?: string }): Equipment[] {
    let list = this.equipment.filter((e) => !e.is_archived);

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.equipment_code.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q)
      );
    }
    if (params?.equipment_type) {
      list = list.filter((e) => e.equipment_type === params.equipment_type);
    }
    if (params?.operational_status) {
      list = list.filter((e) => e.operational_status === params.operational_status);
    }

    return list.map((eq) => {
      const activeAlerts = this.alerts.filter((a) => a.equipment_id === eq.id && a.status !== 'resolved').length;
      return {
        ...eq,
        active_alerts_count: activeAlerts,
      };
    });
  }

  getEquipment(id: number): Equipment {
    const eq = this.equipment.find((e) => e.id === id);
    if (!eq) throw new Error(`Equipment ${id} not found`);
    const activeAlerts = this.alerts.filter((a) => a.equipment_id === id && a.status !== 'resolved').length;
    return { ...eq, active_alerts_count: activeAlerts };
  }

  createEquipment(data: Partial<Equipment>): Equipment {
    const newId = Math.max(0, ...this.equipment.map((e) => e.id)) + 1;
    const newEq: Equipment = {
      id: newId,
      equipment_code: data.equipment_code || `EQ-${newId}`,
      name: data.name || 'New Asset',
      equipment_type: data.equipment_type || 'pump',
      location: data.location || 'Facility Cell',
      description: data.description,
      operational_status: data.operational_status || 'operational',
      installation_date: data.installation_date || new Date().toISOString(),
      sensor_thresholds: data.sensor_thresholds,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_score: 100,
      health_category: 'Good',
      active_alerts_count: 0,
      latest_telemetry_timestamp: new Date().toISOString(),
    };
    this.equipment.push(newEq);
    this.telemetryMap.set(newId, generateInitialTelemetry(newId, 30));
    this.persist();
    return newEq;
  }

  archiveEquipment(id: number) {
    const eq = this.equipment.find((e) => e.id === id);
    if (eq) {
      eq.is_archived = true;
      eq.operational_status = 'offline';
      this.persist();
    }
  }

  // --- Telemetry ---
  getRecentTelemetry(equipmentId: number, limit = 50): Telemetry[] {
    let stream = this.telemetryMap.get(equipmentId);
    if (!stream || stream.length === 0) {
      stream = generateInitialTelemetry(equipmentId, 30);
      this.telemetryMap.set(equipmentId, stream);
    }
    return stream.slice(-limit);
  }

  getAggregatedTelemetry(equipmentId: number, period = '24h') {
    const stream = this.getRecentTelemetry(equipmentId, 40);
    const bucketCount = period === '1h' ? 12 : period === '6h' ? 24 : 24;
    const points = stream.slice(-bucketCount).map((t, idx) => ({
      bucket_time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      avg_temperature: t.temperature,
      max_temperature: Number((t.temperature + 1.2).toFixed(2)),
      avg_vibration: t.vibration,
      max_vibration: Number((t.vibration + 0.3).toFixed(3)),
      avg_pressure: t.pressure,
      avg_current: t.motor_current,
      reading_count: 10,
      anomaly_count: t.is_anomaly ? 1 : 0,
    }));

    return {
      equipment_id: equipmentId,
      period,
      points,
    };
  }

  // --- Health Assessment ---
  getHealthAssessment(equipmentId: number): HealthAssessment {
    const eq = this.getEquipment(equipmentId);
    const activeAlerts = this.alerts.filter((a) => a.equipment_id === equipmentId && a.status !== 'resolved');
    const critCount = activeAlerts.filter((a) => a.severity === 'critical').length;
    const highCount = activeAlerts.filter((a) => a.severity === 'high').length;

    let score = 100;
    const factors: any[] = [];
    const activeWarnings: string[] = [];

    if (critCount > 0) {
      score -= critCount * 35;
      factors.push({
        factor: 'Critical Alarms',
        impact: 'negative',
        penalty_points: critCount * 35,
        detail: `${critCount} critical alarm(s) active on this asset requiring immediate intervention.`,
      });
      activeWarnings.push(`${critCount} Critical Alarm(s)`);
    }

    if (highCount > 0) {
      score -= highCount * 15;
      factors.push({
        factor: 'High Severity Warnings',
        impact: 'negative',
        penalty_points: highCount * 15,
        detail: `${highCount} high alarm(s) logged.`,
      });
      activeWarnings.push(`${highCount} Warning Alarm(s)`);
    }

    if (factors.length === 0) {
      factors.push({
        factor: 'Nominal Operating Baseline',
        impact: 'positive',
        penalty_points: 0,
        detail: 'All monitored sensor channels within nominal ISO and OEM design envelopes.',
      });
    }

    const finalScore = Math.max(15, Math.min(100, score));
    let cat = 'Good';
    if (finalScore < 40) cat = 'Critical';
    else if (finalScore < 65) cat = 'Poor';
    else if (finalScore < 85) cat = 'Fair';

    return {
      equipment_id: equipmentId,
      equipment_code: eq.equipment_code,
      equipment_name: eq.name,
      health_score: finalScore,
      health_category: cat,
      telemetry_status: 'Fresh',
      latest_telemetry_timestamp: new Date().toISOString(),
      minutes_since_last_reading: 1.2,
      contributing_factors: factors,
      active_warning_conditions: activeWarnings,
      assessment_explanation:
        finalScore < 50
          ? 'Physical condition significantly degraded by active critical alarms and elevated vibration.'
          : 'Asset operating smoothly with healthy mechanical and thermal margins.',
      methodology_note:
        'Multi-factor heuristic index evaluated from active alarms, sensor headroom, and anomaly rates.',
    };
  }

  // --- Diagnostics ---
  getDiagnostics(equipmentId: number): DiagnosticReport {
    const eq = this.getEquipment(equipmentId);
    const stream = this.getRecentTelemetry(equipmentId, 10);
    const latest = stream[stream.length - 1];

    const hasHighVib = latest ? latest.vibration >= 5.0 : false;
    const hasHighTemp = latest ? latest.temperature >= 80.0 : false;

    return {
      equipment_id: equipmentId,
      equipment_code: eq.equipment_code,
      equipment_name: eq.name,
      generated_at: new Date().toISOString(),
      engine_used: 'Deterministic Rule-Based Expert System (FMEA)',
      observations_summary:
        hasHighVib || hasHighTemp
          ? `Asset ${eq.equipment_code} exhibits elevated mechanical/thermal stress. Vibration velocity (${latest?.vibration} mm/s) or temperature (${latest?.temperature}°C) deviates from baseline.`
          : `Asset ${eq.equipment_code} is operating within normal ISO 10816 baseline limits. Mechanical and process parameters are stable.`,
      risk_level: hasHighVib && hasHighTemp ? 'Critical' : hasHighVib || hasHighTemp ? 'Elevated' : 'Low',
      measured_evidence: [
        {
          metric: 'Bearing / Core Temperature',
          latest_value: latest?.temperature || 55,
          unit: '°C',
          threshold: 'Warn: 75°C, Crit: 90°C',
          status: hasHighTemp ? 'Critical' : 'Normal',
          historical_context: 'Recent average: 56.4°C',
        },
        {
          metric: 'Vibration Velocity (ISO 10816)',
          latest_value: latest?.vibration || 2.2,
          unit: 'mm/s RMS',
          threshold: 'Warn: 4.5 mm/s, Crit: 7.1 mm/s',
          status: hasHighVib ? 'Critical' : 'Normal',
          historical_context: 'Baseline: 2.1 mm/s RMS',
        },
        {
          metric: 'Discharge / Header Pressure',
          latest_value: latest?.pressure || 3.2,
          unit: 'bar',
          threshold: 'Safe range: [2.0 - 6.5] bar',
          status: 'Normal',
          historical_context: 'Nominal process envelope',
        },
        {
          metric: 'Motor Phase Current',
          latest_value: latest?.motor_current || 22.0,
          unit: 'A',
          threshold: 'Full Load Rating: 38.0 A',
          status: 'Normal',
          historical_context: 'Balanced 3-phase load',
        },
      ],
      possible_causes:
        hasHighVib || hasHighTemp
          ? [
              'Bearing rolling element fatigue spalling or lubricant degradation.',
              'Angular/parallel shaft coupling misalignment causing 2X harmonic vibration.',
              'Dynamic impeller unbalance due to particulate buildup.',
            ]
          : [
              'Asset operating normally within design specifications.',
              'No structural looseness or thermal breakdown detected.',
            ],
      suggested_checks: [
        {
          check_name: 'Laser Shaft Alignment Survey',
          subsystem: 'Mechanical',
          priority: hasHighVib ? 'Immediate' : 'Routine',
          procedure: 'Mount laser alignment detector heads; inspect radial and axial offset across flexible coupling.',
        },
        {
          check_name: 'High-Frequency Ultrasonic Bearing Scan',
          subsystem: 'Mechanical',
          priority: hasHighTemp ? 'Immediate' : 'Routine',
          procedure: 'Measure decibel microvolt acoustic emissions to detect early subsurface bearing raceway distress.',
        },
        {
          check_name: 'Motor Phase Current Imbalance Audit',
          subsystem: 'Electrical',
          priority: 'Medium',
          procedure: 'Inspect L1/L2/L3 clamp currents with RMS power analyzer; confirm phase balance within 3%.',
        },
      ],
      recommended_actions:
        hasHighVib || hasHighTemp
          ? [
              'Schedule an emergency maintenance inspection window.',
              'Replenish ISO VG polyurea grease and inspect oil sight glass for discoloration.',
              'Check foundation anchor bolt torques against OEM specifications.',
            ]
          : [
              'Continue normal automated telemetry monitoring.',
              'Perform next planned quarterly preventive lubrication inspection as scheduled.',
            ],
      uncertainty_and_limitations:
        'Diagnostic analysis is synthesized deterministically using ISO 10816 standards, empirical threshold bounds, and failure trees. Physical inspection by plant reliability engineers is mandatory before component overhaul.',
    };
  }

  // --- Alerts ---
  listAlerts(params?: { status?: string; severity?: string; alert_type?: string; equipment_id?: number }): Alert[] {
    let list = [...this.alerts];
    if (params?.status) list = list.filter((a) => a.status === params.status);
    if (params?.severity) list = list.filter((a) => a.severity === params.severity);
    if (params?.alert_type) list = list.filter((a) => a.alert_type === params.alert_type);
    if (params?.equipment_id) list = list.filter((a) => a.equipment_id === params.equipment_id);
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  acknowledgeAlert(id: number): Alert {
    const a = this.alerts.find((al) => al.id === id);
    if (!a) throw new Error('Alert not found');
    a.status = 'acknowledged';
    a.acknowledged_at = new Date().toISOString();
    a.acknowledged_by = 'Marcus Kane (Reliability Engineer)';
    this.persist();
    return a;
  }

  resolveAlert(id: number, notes: string): Alert {
    const a = this.alerts.find((al) => al.id === id);
    if (!a) throw new Error('Alert not found');
    a.status = 'resolved';
    a.resolved_at = new Date().toISOString();
    a.resolved_by = 'Marcus Kane (Reliability Engineer)';
    a.resolution_notes = notes;

    // Check remaining critical alerts on equipment
    const eq = this.equipment.find((e) => e.id === a.equipment_id);
    if (eq) {
      const remainingCrits = this.alerts.filter(
        (al) => al.equipment_id === eq.id && al.id !== id && al.status !== 'resolved' && al.severity === 'critical'
      ).length;
      if (remainingCrits === 0) {
        eq.operational_status = 'operational';
        eq.health_score = 92;
        eq.health_category = 'Good';
      }
    }

    this.persist();
    return a;
  }

  // --- Maintenance ---
  listMaintenance(params?: { status?: string }): MaintenanceRecord[] {
    let list = [...this.maintenance];
    const now = new Date();
    if (params?.status === 'overdue') {
      list = list.filter((m) => m.status !== 'completed' && new Date(m.scheduled_date) < now);
    } else if (params?.status === 'upcoming') {
      list = list.filter((m) => m.status === 'scheduled' && new Date(m.scheduled_date) >= now);
    } else if (params?.status) {
      list = list.filter((m) => m.status === params.status);
    }
    return list.sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());
  }

  createMaintenance(data: Partial<MaintenanceRecord>): MaintenanceRecord {
    const newId = Math.max(0, ...this.maintenance.map((m) => m.id)) + 1;
    const newMaint: MaintenanceRecord = {
      id: newId,
      equipment_id: data.equipment_id || 1,
      title: data.title || 'Scheduled Service',
      description: data.description,
      maintenance_type: data.maintenance_type || 'preventive',
      priority: data.priority || 'medium',
      status: 'scheduled',
      scheduled_date: data.scheduled_date || new Date().toISOString(),
      assigned_technician: data.assigned_technician || 'Marcus Kane',
      notes: data.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.maintenance.unshift(newMaint);
    this.persist();
    return newMaint;
  }

  completeMaintenance(id: number, data: { work_performed: string; parts_used?: string; notes?: string }): MaintenanceRecord {
    const m = this.maintenance.find((rec) => rec.id === id);
    if (!m) throw new Error('Maintenance record not found');
    m.status = 'completed';
    m.completion_date = new Date().toISOString();
    m.work_performed = data.work_performed;
    if (data.parts_used) m.parts_used = data.parts_used;
    if (data.notes) m.notes = data.notes;
    this.persist();
    return m;
  }

  // --- Dashboard ---
  getDashboard(days = 7): DashboardData {
    const eqList = this.listEquipment();
    const openAlerts = this.alerts.filter((a) => a.status !== 'resolved');
    const critAlerts = openAlerts.filter((a) => a.severity === 'critical');
    const highAlerts = openAlerts.filter((a) => a.severity === 'high');

    const healthy = eqList.filter((e) => (e.health_score || 0) >= 85).length;
    const attention = eqList.filter((e) => (e.health_score || 0) >= 40 && (e.health_score || 0) < 85).length;
    const critical = eqList.filter((e) => (e.health_score || 0) < 40).length;

    const now = new Date();
    const upcoming = this.maintenance.filter((m) => m.status === 'scheduled' && new Date(m.scheduled_date) >= now).length;
    const overdue = this.maintenance.filter((m) => m.status !== 'completed' && new Date(m.scheduled_date) < now).length;

    // Build trend from telemetry
    const pumpTel = this.getRecentTelemetry(1, 15);
    const trendPoints = pumpTel.map((t) => ({
      time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      avg_temp: t.temperature,
      avg_vib: t.vibration,
      avg_press: t.pressure,
      avg_curr: t.motor_current,
    }));

    return {
      kpis: {
        total_equipment: eqList.length,
        healthy_equipment: healthy,
        attention_equipment: attention,
        critical_equipment: critical,
        active_alerts: openAlerts.length,
        critical_alerts: critAlerts.length,
        high_alerts: highAlerts.length,
        upcoming_maintenance: upcoming,
        overdue_maintenance: overdue,
        completed_maintenance_window: 4,
        system_mean_health: 84.5,
      },
      health_distribution: {
        'Good (85-100)': healthy,
        'Fair (65-84)': 1,
        'Poor (40-64)': 1,
        'Critical (0-39)': critical,
        'Offline/Stale': 0,
      },
      telemetry_trends: trendPoints,
      latest_alerts: this.alerts.slice(0, 5).map((a) => ({
        id: a.id,
        equipment_id: a.equipment_id,
        title: a.title,
        severity: a.severity,
        alert_type: a.alert_type,
        status: a.status,
        timestamp: a.timestamp,
      })),
    };
  }

  // --- Simulator ---
  getSimulatorStatus(): SimulatorStatus {
    const eq = this.simStatus.equipment_id ? this.equipment.find((e) => e.id === this.simStatus.equipment_id) : null;
    return {
      ...this.simStatus,
      equipment_code: eq?.equipment_code,
    };
  }

  startSimulator(equipmentId: number, scenario: string, intervalSeconds = 2.0): SimulatorStatus {
    this.stopSimulator();
    this.simStatus = {
      is_running: true,
      equipment_id: equipmentId,
      scenario,
      interval_seconds: intervalSeconds,
      readings_generated: 0,
      current_step: 0,
      last_reading_time: new Date().toISOString(),
      status_message: 'Running',
    };

    this.simIntervalTimer = setInterval(() => {
      this.tickSimulator();
    }, intervalSeconds * 1000);

    return this.getSimulatorStatus();
  }

  stopSimulator(): SimulatorStatus {
    if (this.simIntervalTimer) {
      clearInterval(this.simIntervalTimer);
      this.simIntervalTimer = null;
    }
    this.simStatus.is_running = false;
    this.simStatus.status_message = 'Stopped';
    return this.getSimulatorStatus();
  }

  resetSimulator(): SimulatorStatus {
    this.stopSimulator();
    this.simStatus = {
      is_running: false,
      interval_seconds: 2.0,
      readings_generated: 0,
      current_step: 0,
      status_message: 'Idle',
    };
    this.simRecentReadings = [];
    return this.simStatus;
  }

  getSimulatorReadings(): any[] {
    return this.simRecentReadings.slice(-20);
  }

  private tickSimulator() {
    if (!this.simStatus.is_running || !this.simStatus.equipment_id) return;
    this.simStatus.current_step++;
    this.simStatus.readings_generated++;

    const eqId = this.simStatus.equipment_id;
    const step = this.simStatus.current_step;
    const scen = this.simStatus.scenario;

    let temp = 55.0 + (Math.random() * 2 - 1);
    let vib = 2.2 + (Math.random() * 0.4 - 0.2);
    const press = 3.2 + (Math.random() * 0.2 - 0.1);
    let curr = 21.0 + (Math.random() * 1.5 - 0.7);
    let isAnom = false;
    let anomScore = 0.25;

    if (scen === 'deterioration') {
      const prog = Math.min(1.0, step / 20);
      temp += prog * 35;
      vib += prog * 6.0;
      curr += prog * 10;
      if (prog > 0.4) {
        isAnom = true;
        anomScore = 0.75 + prog * 0.2;
      }
    } else if (scen === 'anomaly') {
      if (step >= 3) {
        temp += 38;
        vib += 6.5;
        isAnom = true;
        anomScore = 0.92;
      }
    } else if (scen === 'sensor_failure') {
      temp = 99.9;
      vib = 0.0;
      isAnom = true;
      anomScore = 0.85;
    }

    const newReading: Telemetry = {
      id: Date.now(),
      equipment_id: eqId,
      timestamp: new Date().toISOString(),
      temperature: Number(temp.toFixed(2)),
      vibration: Number(vib.toFixed(3)),
      pressure: Number(press.toFixed(2)),
      motor_current: Number(curr.toFixed(2)),
      speed_rpm: 1485,
      sensor_quality: scen === 'sensor_failure' ? 'bad' : 'good',
      is_anomaly: isAnom,
      anomaly_score: Number(anomScore.toFixed(3)),
    };

    const stream = this.telemetryMap.get(eqId) || [];
    stream.push(newReading);
    if (stream.length > 50) stream.shift();
    this.telemetryMap.set(eqId, stream);

    this.simRecentReadings.push(newReading);
    if (this.simRecentReadings.length > 30) this.simRecentReadings.shift();

    // Trigger alerts if threshold exceeded
    if (vib >= 7.0) {
      const existing = this.alerts.find(
        (a) => a.equipment_id === eqId && a.severity === 'critical' && a.status === 'open'
      );
      if (!existing) {
        this.alerts.unshift({
          id: Date.now(),
          equipment_id: eqId,
          alert_type: 'threshold_violation',
          severity: 'critical',
          title: `Severe Vibration Breach on ${this.getEquipment(eqId).equipment_code}`,
          description: `Vibration ${newReading.vibration} mm/s RMS violated critical ISO Zone D envelope.`,
          triggering_measurement: { metric: 'vibration', value: newReading.vibration, unit: 'mm/s RMS' },
          detection_reason: 'Live simulation threshold excursion',
          status: 'open',
          timestamp: new Date().toISOString(),
        });
        const eq = this.equipment.find((e) => e.id === eqId);
        if (eq) eq.operational_status = 'critical';
        this.persist();
      }
    }
  }
}

export const mockStore = new ClientMockStore();
