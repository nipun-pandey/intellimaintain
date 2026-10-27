"""initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='engineer'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # 2. equipment
    op.create_table(
        'equipment',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('equipment_code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('equipment_type', sa.String(length=100), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('operational_status', sa.String(length=50), nullable=False, server_default='operational'),
        sa.Column('installation_date', sa.DateTime(), nullable=True),
        sa.Column('sensor_thresholds', sa.JSON(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_equipment_code'), 'equipment', ['equipment_code'], unique=True)
    op.create_index(op.f('ix_equipment_type'), 'equipment', ['equipment_type'], unique=False)
    op.create_index(op.f('ix_equipment_status'), 'equipment', ['operational_status'], unique=False)
    op.create_index(op.f('ix_equipment_archived'), 'equipment', ['is_archived'], unique=False)

    # 3. telemetry
    op.create_table(
        'telemetry',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('equipment_id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('temperature', sa.Float(), nullable=False),
        sa.Column('vibration', sa.Float(), nullable=False),
        sa.Column('pressure', sa.Float(), nullable=False),
        sa.Column('motor_current', sa.Float(), nullable=False),
        sa.Column('speed_rpm', sa.Float(), nullable=True),
        sa.Column('sensor_quality', sa.String(length=50), nullable=False, server_default='good'),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('is_anomaly', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('anomaly_score', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_telemetry_timestamp'), 'telemetry', ['timestamp'], unique=False)
    op.create_index('idx_equipment_timestamp', 'telemetry', ['equipment_id', 'timestamp'], unique=False)

    # 4. alert_rules
    op.create_table(
        'alert_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('equipment_id', sa.Integer(), nullable=True),
        sa.Column('rule_name', sa.String(length=255), nullable=False),
        sa.Column('metric', sa.String(length=100), nullable=False),
        sa.Column('condition_type', sa.String(length=50), nullable=False),
        sa.Column('warning_threshold', sa.Float(), nullable=True),
        sa.Column('critical_threshold', sa.Float(), nullable=True),
        sa.Column('min_range', sa.Float(), nullable=True),
        sa.Column('max_range', sa.Float(), nullable=True),
        sa.Column('cooldown_seconds', sa.Integer(), nullable=False, server_default='300'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 5. alerts
    op.create_table(
        'alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('equipment_id', sa.Integer(), nullable=False),
        sa.Column('alert_type', sa.String(length=100), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('triggering_measurement', sa.JSON(), nullable=True),
        sa.Column('detection_reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='open'),
        sa.Column('cooldown_key', sa.String(length=255), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('acknowledged_by', sa.String(length=255), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by', sa.String(length=255), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_alert_status_equipment', 'alerts', ['status', 'equipment_id'], unique=False)
    op.create_index('idx_alert_timestamp_desc', 'alerts', ['timestamp'], unique=False)

    # 6. maintenance_records
    op.create_table(
        'maintenance_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('equipment_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('maintenance_type', sa.String(length=50), nullable=False),
        sa.Column('priority', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='scheduled'),
        sa.Column('scheduled_date', sa.DateTime(), nullable=False),
        sa.Column('completion_date', sa.DateTime(), nullable=True),
        sa.Column('assigned_technician', sa.String(length=255), nullable=True),
        sa.Column('work_performed', sa.Text(), nullable=True),
        sa.Column('parts_used', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_maint_status_date', 'maintenance_records', ['status', 'scheduled_date'], unique=False)


def downgrade() -> None:
    op.drop_table('maintenance_records')
    op.drop_table('alerts')
    op.drop_table('alert_rules')
    op.drop_table('telemetry')
    op.drop_table('equipment')
    op.drop_table('users')
