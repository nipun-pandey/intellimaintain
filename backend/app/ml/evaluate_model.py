"""
IntelliMaintain — Isolation Forest Anomaly Detection Evaluation Script
Evaluates the multivariate anomaly detector on a synthetic labelled industrial dataset.

NOTE: Synthetic-data evaluation is a demonstration benchmark to verify mathematical
stability, precision, and recall under controlled perturbation scenarios. It is NOT
a substitute for empirical field testing on real industrial failure modes. Anomaly scores
represent outlier distances, NOT calibrated probabilities of equipment failure.
"""

import json
import numpy as np
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)
from app.ml.anomaly_detector import IsolationForestAnomalyDetector
from app.ml.pipeline import FEATURE_NAMES


def generate_evaluation_dataset(n_normal: int = 1000, n_anomalies: int = 100, random_seed: int = 42):
    """Generates ground-truth labeled normal and anomalous industrial sensor telemetry."""
    np.random.seed(random_seed)

    # 1. Normal operating regime (Label 0)
    normal_temp = np.random.normal(loc=55.0, scale=4.0, size=n_normal)
    normal_vib = np.random.normal(loc=2.2, scale=0.5, size=n_normal)
    normal_press = np.random.normal(loc=3.2, scale=0.3, size=n_normal)
    normal_curr = np.random.normal(loc=21.0, scale=2.0, size=n_normal)
    normal_rpm = np.random.normal(loc=1485.0, scale=10.0, size=n_normal)

    normal_data = np.column_stack([normal_temp, normal_vib, normal_press, normal_curr, normal_rpm])
    y_normal = np.zeros(n_normal, dtype=int)

    # 2. Anomalous operating regime (Label 1)
    # Mixture of bearing wear (vibration spike), cavitation (pressure drops + vibration),
    # thermal runaway (temperature spike + current spike)
    n_bearing = n_anomalies // 3
    n_thermal = n_anomalies // 3
    n_cavitation = n_anomalies - (n_bearing + n_thermal)

    # Bearing degradation: excessive vibration + slight temperature rise
    b_vib = np.random.uniform(6.5, 12.0, size=n_bearing)
    b_temp = np.random.normal(70.0, 5.0, size=n_bearing)
    b_press = np.random.normal(3.2, 0.4, size=n_bearing)
    b_curr = np.random.normal(23.0, 2.0, size=n_bearing)
    b_rpm = np.random.normal(1485.0, 15.0, size=n_bearing)
    bearing_data = np.column_stack([b_temp, b_vib, b_press, b_curr, b_rpm])

    # Thermal runaway: high current and high temperature
    t_vib = np.random.normal(2.5, 0.5, size=n_thermal)
    t_temp = np.random.uniform(92.0, 125.0, size=n_thermal)
    t_press = np.random.normal(3.2, 0.4, size=n_thermal)
    t_curr = np.random.uniform(38.0, 55.0, size=n_thermal)
    t_rpm = np.random.normal(1470.0, 20.0, size=n_thermal)
    thermal_data = np.column_stack([t_temp, t_vib, t_press, t_curr, t_rpm])

    # Cavitation: pressure drops with erratic vibration
    c_vib = np.random.uniform(5.5, 9.0, size=n_cavitation)
    c_temp = np.random.normal(56.0, 4.0, size=n_cavitation)
    c_press = np.random.uniform(0.5, 1.2, size=n_cavitation)
    c_curr = np.random.normal(18.0, 2.0, size=n_cavitation)
    c_rpm = np.random.normal(1490.0, 10.0, size=n_cavitation)
    cavitation_data = np.column_stack([c_temp, c_vib, c_press, c_curr, c_rpm])

    anomaly_data = np.vstack([bearing_data, thermal_data, cavitation_data])
    y_anomaly = np.ones(n_anomalies, dtype=int)

    X_test = np.vstack([normal_data, anomaly_data])
    y_true = np.concatenate([y_normal, y_anomaly])

    return X_test, y_true


def run_evaluation():
    print("=" * 70)
    print("  IntelliMaintain — Isolation Forest Anomaly Detection Benchmark")
    print("=" * 70)

    detector = IsolationForestAnomalyDetector(contamination=0.08, n_estimators=100, random_state=42)

    X_test, y_true = generate_evaluation_dataset(n_normal=1000, n_anomalies=100, random_seed=42)

    # Predictions
    y_pred = []
    scores = []

    for row in X_test:
        reading = {
            "temperature": row[0],
            "vibration": row[1],
            "pressure": row[2],
            "motor_current": row[3],
            "speed_rpm": row[4],
        }
        is_anom, score, _ = detector.score_reading(reading)
        y_pred.append(1 if is_anom else 0)
        scores.append(score)

    y_pred = np.array(y_pred)
    scores = np.array(scores)

    # Compute actual metrics
    precision = precision_score(y_true, y_pred)
    recall = recall_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred)
    cm = confusion_matrix(y_true, y_pred)

    tn, fp, fn, tp = cm.ravel()

    results = {
        "dataset": {
            "total_samples": int(len(y_true)),
            "normal_samples": int(np.sum(y_true == 0)),
            "anomalous_samples": int(np.sum(y_true == 1)),
        },
        "metrics": {
            "precision": float(round(precision, 4)),
            "recall": float(round(recall, 4)),
            "f1_score": float(round(f1, 4)),
            "accuracy": float(round((tp + tn) / len(y_true), 4)),
        },
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp),
        },
        "score_statistics": {
            "normal_mean_score": float(round(np.mean(scores[y_true == 0]), 4)),
            "anomaly_mean_score": float(round(np.mean(scores[y_true == 1]), 4)),
        },
        "limitations": [
            "Unsupervised model relies on contamination assumptions and clean baseline training.",
            "Synthetic evaluation does not account for factory ambient temperature fluctuations or seasonal drift.",
            "Requires periodic retraining or online adaptation to avoid false positives during new production cycles.",
            "Score reflects outlier distance, not calibrated probability of imminent mechanical failure."
        ]
    }

    print(f"Total Test Samples: {len(y_true)} (Normal: {tn+fp}, Anomalies: {fn+tp})")
    print(f"Precision:         {precision:.4f}")
    print(f"Recall:            {recall:.4f}")
    print(f"F1 Score:          {f1:.4f}")
    print(f"Confusion Matrix:  TN={tn}, FP={fp}, FN={fn}, TP={tp}")
    print("\nDetailed Classification Report:")
    print(classification_report(y_true, y_pred, target_names=["Normal", "Anomaly"]))

    return results


if __name__ == "__main__":
    results = run_evaluation()
    with open("model_evaluation_report.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nSaved evaluation results to model_evaluation_report.json")
