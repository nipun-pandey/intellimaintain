import os
import joblib
import numpy as np
from typing import Dict, Any, Tuple, Optional, List
from sklearn.ensemble import IsolationForest
from app.ml.pipeline import IndustrialFeaturePipeline, FEATURE_NAMES


MODEL_PATH = os.path.join(os.path.dirname(__file__), "trained_isolation_forest.joblib")


class IsolationForestAnomalyDetector:
    """
    Unsupervised industrial telemetry anomaly detector using scikit-learn Isolation Forest.
    Detects multivariate operational outliers across temperature, vibration, pressure, current, and RPM.
    """

    def __init__(self, contamination: float = 0.05, n_estimators: int = 100, random_state: int = 42):
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.random_state = random_state
        self.pipeline = IndustrialFeaturePipeline()
        self.model = IsolationForest(
            contamination=self.contamination,
            n_estimators=self.n_estimators,
            random_state=self.random_state,
            n_jobs=1,
        )
        self.is_trained = False
        self.baseline_stats: Dict[str, Dict[str, float]] = {}

        # Initialize with reliable industrial baseline if no saved model is found
        self._initialize_or_load()

    def _generate_synthetic_baseline(self, n_samples: int = 800) -> np.ndarray:
        """Generates representative normal industrial operating envelope for cold start."""
        np.random.seed(self.random_state)
        # Normal distributions around typical industrial machine specs
        temp = np.random.normal(loc=55.0, scale=6.0, size=n_samples)
        vib = np.random.normal(loc=2.2, scale=0.6, size=n_samples)
        press = np.random.normal(loc=3.2, scale=0.4, size=n_samples)
        curr = np.random.normal(loc=21.0, scale=2.5, size=n_samples)
        rpm = np.random.normal(loc=1485.0, scale=15.0, size=n_samples)

        X = np.column_stack([temp, vib, press, curr, rpm])
        return X

    def _initialize_or_load(self):
        """Loads saved weights if present, else trains on industrial baseline."""
        if os.path.exists(MODEL_PATH):
            try:
                saved = joblib.load(MODEL_PATH)
                self.model = saved["model"]
                self.pipeline = saved["pipeline"]
                self.baseline_stats = saved.get("baseline_stats", {})
                self.is_trained = True
                return
            except Exception:
                pass

        # Cold-start baseline training
        baseline_X = self._generate_synthetic_baseline(1000)
        self.train(baseline_X, persist=False)

    def train(self, X: np.ndarray, persist: bool = True):
        """Trains or refits the Isolation Forest on feature matrix X."""
        if len(X) < 20:
            raise ValueError(f"Insufficient data to train Isolation Forest. Need at least 20 samples, got {len(X)}")

        X_transformed = self.pipeline.fit_transform(X)
        self.model.fit(X_transformed)
        self.is_trained = True

        # Compute baseline means and standard deviations for explaining anomalies
        self.baseline_stats = {}
        for idx, feat in enumerate(FEATURE_NAMES):
            col_vals = X[:, idx]
            self.baseline_stats[feat] = {
                "mean": float(np.mean(col_vals)),
                "std": float(np.std(col_vals)) or 1.0,
            }

        if persist:
            try:
                joblib.dump({
                    "model": self.model,
                    "pipeline": self.pipeline,
                    "baseline_stats": self.baseline_stats,
                }, MODEL_PATH)
            except Exception:
                pass

    def score_reading(self, reading_dict: Dict[str, Any]) -> Tuple[bool, float, str]:
        """
        Scores an individual telemetry reading.
        Returns:
            - is_anomaly (bool): True if identified as an operational anomaly.
            - anomaly_score (float): Normalized severity score in [0.0, 1.0].
            - explanation (str): Root-cause breakdown of deviating physical features.
        """
        raw_vec = self.pipeline.extract_features_from_dict(reading_dict)
        transformed_vec = self.pipeline.transform(raw_vec)

        # Isolation forest decision_function: lower means more abnormal
        raw_score = self.model.decision_function(transformed_vec)[0]
        prediction = self.model.predict(transformed_vec)[0]  # -1 for anomaly, 1 for normal

        # Normalize score into [0.0, 1.0] where 1.0 is severe anomaly
        # Typically raw_score ranges around -0.3 (extreme) to +0.25 (typical normal)
        normalized_score = float(np.clip((0.15 - raw_score) / 0.40, 0.0, 1.0))
        is_anomaly = bool(prediction == -1 or normalized_score >= 0.65)

        # Build feature explanation
        deviations = []
        for idx, feat in enumerate(FEATURE_NAMES):
            val = raw_vec[0][idx]
            stats = self.baseline_stats.get(feat, {"mean": 50.0, "std": 10.0})
            z_score = abs(val - stats["mean"]) / stats["std"]
            if z_score >= 2.0:
                deviations.append(f"{feat.capitalize()} ({val:.1f}, {z_score:.1f}σ from baseline)")

        if is_anomaly:
            if deviations:
                explanation = f"Multivariate outlier: {', '.join(deviations)}"
            else:
                explanation = f"Subtle multivariate correlation outlier (Isolation score: {normalized_score:.2f})"
        else:
            explanation = "Normal operating regime"

        return is_anomaly, round(normalized_score, 3), explanation


# Singleton detector instance for backend runtime
detector = IsolationForestAnomalyDetector()
