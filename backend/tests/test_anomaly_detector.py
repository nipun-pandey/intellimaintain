from app.ml.anomaly_detector import detector
from app.ml.pipeline import IndustrialFeaturePipeline


def test_pipeline_extraction():
    pipeline = IndustrialFeaturePipeline()
    reading = {
        "temperature": 60.5,
        "vibration": 2.4,
        "pressure": 3.1,
        "motor_current": 21.0,
        "speed_rpm": 1495.0,
    }
    vec = pipeline.extract_features_from_dict(reading)
    assert vec.shape == (1, 5)
    assert vec[0][0] == 60.5
    assert vec[0][1] == 2.4


def test_anomaly_detector_normal_reading():
    reading = {
        "temperature": 55.0,
        "vibration": 2.2,
        "pressure": 3.2,
        "motor_current": 21.0,
        "speed_rpm": 1485.0,
    }
    is_anom, score, explanation = detector.score_reading(reading)
    assert is_anom is False
    assert 0.0 <= score <= 0.65
    assert "Normal" in explanation


def test_anomaly_detector_extreme_multivariate_outlier():
    # Extreme abnormal readings simultaneously
    reading = {
        "temperature": 115.0,
        "vibration": 14.5,
        "pressure": 0.5,
        "motor_current": 48.0,
        "speed_rpm": 1320.0,
    }
    is_anom, score, explanation = detector.score_reading(reading)
    assert is_anom is True
    assert score >= 0.65
    assert "outlier" in explanation.lower() or "deviat" in explanation.lower()
