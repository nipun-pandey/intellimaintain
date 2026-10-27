import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from sklearn.preprocessing import StandardScaler


FEATURE_NAMES = ["temperature", "vibration", "pressure", "motor_current", "speed_rpm"]


class IndustrialFeaturePipeline:
    """
    Feature preprocessing pipeline for industrial equipment telemetry.
    Extracts core features, handles missing values, and normalizes telemetry vectors.
    """

    def __init__(self):
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.default_rpm = 1500.0

    def extract_features_from_dict(self, data: Dict[str, Any]) -> np.ndarray:
        """Extract a single feature vector from a telemetry dict or model instance."""
        temp = float(data.get("temperature", 50.0))
        vib = float(data.get("vibration", 2.0))
        press = float(data.get("pressure", 3.0))
        curr = float(data.get("motor_current", 20.0))
        rpm = float(data.get("speed_rpm") or self.default_rpm)

        # Impute or bound invalid values
        temp = np.clip(temp, -30.0, 300.0)
        vib = np.clip(vib, 0.0, 100.0)
        press = np.clip(press, 0.0, 100.0)
        curr = np.clip(curr, 0.0, 500.0)
        rpm = np.clip(rpm, 0.0, 10000.0)

        return np.array([[temp, vib, press, curr, rpm]], dtype=np.float64)

    def extract_features_from_list(self, records: List[Dict[str, Any]]) -> np.ndarray:
        """Extract feature matrix from a list of records."""
        vectors = [self.extract_features_from_dict(r)[0] for r in records]
        return np.array(vectors, dtype=np.float64)

    def fit(self, X: np.ndarray) -> "IndustrialFeaturePipeline":
        if len(X) > 0:
            self.scaler.fit(X)
            self.is_fitted = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        if self.is_fitted:
            return self.scaler.transform(X)
        return X

    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        self.fit(X)
        return self.transform(X)
