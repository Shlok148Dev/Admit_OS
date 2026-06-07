"""
Model module containing XGBoost + LightGBM ensemble model training,
prediction, and bootstrap resampling for confidence intervals.
"""

import logging
from typing import Dict, Tuple, Any
import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error
import mlflow.pyfunc


logger: logging.Logger = logging.getLogger("prediction_service.model")

COLLEGE_MAP: Dict[str, int] = {
    val: idx for idx, val in enumerate([
        "IIT_BOMBAY", "IIT_DELHI", "IIT_MADRAS", "NIT_TRICHY", "NIT_SURATHKAL",
        "IIIT_ALLAHABAD", "IIIT_DELHI", "COEP_PUNE", "VJTI_MUMBAI", "ICT_MUMBAI"
    ])
}
BRANCH_MAP: Dict[str, int] = {"CS": 0, "EC": 1, "ME": 2}
CAT_MAP: Dict[str, int] = {"GENERAL": 0, "OBC_NCL": 1, "SC": 2, "ST": 3, "EWS": 4}
QUOTA_MAP: Dict[str, int] = {"OS": 0, "HS": 1}
GENDER_MAP: Dict[str, int] = {"M": 0, "F": 1}

def get_cutoff_rank(
    college: str, branch: str, cat: str, quota: str, gender: str, year: int
) -> int:
    """Calculate synthetic rank based on college, branch, category, quota, gender, year."""
    bases: Dict[str, int] = {
        "IIT_BOMBAY": 100, "IIT_DELHI": 150, "IIT_MADRAS": 200, "NIT_TRICHY": 800,
        "NIT_SURATHKAL": 1000, "IIIT_ALLAHABAD": 1500, "IIIT_DELHI": 1800,
        "COEP_PUNE": 2500, "VJTI_MUMBAI": 3000, "ICT_MUMBAI": 3500
    }
    base = bases.get(college, 1000)
    branch_mult = {"CS": 1.0, "EC": 1.8, "ME": 3.0}.get(branch, 1.0)
    cat_mult = {"GENERAL": 1.0, "OBC_NCL": 2.5, "SC": 6.0, "ST": 8.0, "EWS": 1.5}.get(cat, 1.0)
    quota_mult = {"OS": 1.0, "HS": 1.3}.get(quota, 1.0)
    gender_mult = {"M": 1.0, "F": 1.2}.get(gender, 1.0)
    year_noise = 1.0 + 0.02 * (year - 2020) + 0.02 * np.random.randn()
    return int(base * branch_mult * cat_mult * quota_mult * gender_mult * year_noise)

def generate_synthetic_cutoffs() -> pd.DataFrame:
    """Generate 10 colleges x 5 years synthetic cutoff data."""
    colleges = list(COLLEGE_MAP.keys())
    branches = list(BRANCH_MAP.keys())
    categories = list(CAT_MAP.keys())
    quotas = list(QUOTA_MAP.keys())
    genders = list(GENDER_MAP.keys())
    years = [2020, 2021, 2022, 2023, 2024]
    
    np.random.seed(42)
    records = []
    for col in colleges:
        for br in branches:
            for cat in categories:
                for q in quotas:
                    for g in genders:
                        for y in years:
                            rank = get_cutoff_rank(col, br, cat, q, g, y)
                            records.append({
                                "college_code": col, "branch_code": br, "category": cat,
                                "quota": q, "gender": g, "year": y, "closing_rank": rank,
                                "opening_rank": int(rank * 0.85)
                            })
    return pd.DataFrame(records)

def add_lags(df: pd.DataFrame) -> pd.DataFrame:
    """Add lag features (lag_1, lag_2) to the dataframe."""
    df_lag1 = df[
        ["college_code", "branch_code", "category", "quota", "gender", "year", "closing_rank"]
    ].copy()
    df_lag1["year"] = df_lag1["year"] + 1
    df_lag1 = df_lag1.rename(columns={"closing_rank": "lag_1"})
    
    df_lag2 = df[
        ["college_code", "branch_code", "category", "quota", "gender", "year", "closing_rank"]
    ].copy()
    df_lag2["year"] = df_lag2["year"] + 2
    df_lag2 = df_lag2.rename(columns={"closing_rank": "lag_2"})
    
    merged = pd.merge(df, df_lag1, on=["college_code", "branch_code", "category", "quota", "gender", "year"])
    merged = pd.merge(merged, df_lag2, on=["college_code", "branch_code", "category", "quota", "gender", "year"])
    return merged

def encode_df(df: pd.DataFrame) -> pd.DataFrame:
    """Encode categorical columns to numeric."""
    encoded = df.copy()
    encoded["college_code_enc"] = encoded["college_code"].map(COLLEGE_MAP)
    encoded["branch_code_enc"] = encoded["branch_code"].map(BRANCH_MAP)
    encoded["category_enc"] = encoded["category"].map(CAT_MAP)
    encoded["quota_enc"] = encoded["quota"].map(QUOTA_MAP)
    encoded["gender_enc"] = encoded["gender"].map(GENDER_MAP)
    return encoded

def compute_bootstrap_intervals(
    bootstrap_preds: np.ndarray,
    student_rank: int
) -> Tuple[int, int, int, float]:
    """Compute P10, P50, P90 and student admission probability."""
    p10 = int(np.percentile(bootstrap_preds, 10))
    p50 = int(np.percentile(bootstrap_preds, 50))
    p90 = int(np.percentile(bootstrap_preds, 90))
    
    p10 = max(1, p10)
    p50 = max(p10, p50)
    p90 = max(p50, p90)
    
    prob = float(np.mean(bootstrap_preds >= student_rank))
    prob = round(max(0.0, min(1.0, prob)), 2)
    return p10, p50, p90, prob

class CutoffPredictor:
    """XGBoost + LightGBM Ensemble Predictor for cutoff ranks."""

    def __init__(self) -> None:
        self.xgb_model = xgb.XGBRegressor(n_estimators=100, max_depth=4, random_state=42)
        self.lgb_model = lgb.LGBMRegressor(
            n_estimators=100, max_depth=4, random_state=42, verbose=-1
        )
        self.xgb_weight = 0.55
        self.lgb_weight = 0.45
        self.residuals: np.ndarray = np.array([])

        # Mappings initialized from globals for backward compatibility
        self.college_map = COLLEGE_MAP.copy()
        self.branch_map = BRANCH_MAP.copy()
        self.cat_map = CAT_MAP.copy()
        self.quota_map = QUOTA_MAP.copy()
        self.gender_map = GENDER_MAP.copy()

        # Auto-train on synthetic data so the predictor is always ready to use.
        # This ensures the fallback path (when MLflow has no production model) works.
        self._bootstrap_fit()

    def _bootstrap_fit(self) -> None:
        """Quickly fit models on synthetic data so predict_one() never raises NotFittedError."""
        try:
            df = generate_synthetic_cutoffs()
            df_lags = add_lags(df)
            df_enc = df_lags.copy()
            df_enc["college_code_enc"] = df_enc["college_code"].map(self.college_map).fillna(0)
            df_enc["branch_code_enc"] = df_enc["branch_code"].map(self.branch_map).fillna(0)
            df_enc["category_enc"] = df_enc["category"].map(self.cat_map).fillna(0)
            df_enc["quota_enc"] = df_enc["quota"].map(self.quota_map).fillna(0)
            df_enc["gender_enc"] = df_enc["gender"].map(self.gender_map).fillna(0)
            features = [
                "college_code_enc", "branch_code_enc", "category_enc", "quota_enc",
                "gender_enc", "lag_1", "lag_2"
            ]
            X = df_enc[features].copy()
            X["lag_1"] = np.log1p(X["lag_1"])
            X["lag_2"] = np.log1p(X["lag_2"])
            y = np.log1p(df_enc["closing_rank"])
            self.xgb_model.fit(X, y)
            self.lgb_model.fit(X, y)
            pred_xgb = self.xgb_model.predict(X)
            pred_lgb = self.lgb_model.predict(X)
            preds = self.xgb_weight * pred_xgb + self.lgb_weight * pred_lgb
            self.residuals = y.values - preds
            logger.info("CutoffPredictor bootstrap-fitted on synthetic data (%d rows)", len(X))
        except Exception as e:
            logger.warning("CutoffPredictor bootstrap fit failed: %s — predict_one may fail", e)

    def train(self, df: pd.DataFrame, exam_type: str = "JEE_MAIN") -> Tuple[float, float]:
        """Train models, log to MLflow, and calculate residuals."""
        # Dynamically build mapping from dataset unique values
        for val in df["college_code"].unique():
            if val not in self.college_map:
                self.college_map[val] = len(self.college_map)
        for val in df["branch_code"].unique():
            if val not in self.branch_map:
                self.branch_map[val] = len(self.branch_map)
        for val in df["category"].unique():
            if val not in self.cat_map:
                self.cat_map[val] = len(self.cat_map)
        for val in df["quota"].unique():
            if val not in self.quota_map:
                self.quota_map[val] = len(self.quota_map)
        for val in df["gender"].unique():
            if val not in self.gender_map:
                self.gender_map[val] = len(self.gender_map)

        df_lags = add_lags(df)
        
        # Encode using the instance-specific mapping dictionaries
        df_enc = df_lags.copy()
        df_enc["college_code_enc"] = df_enc["college_code"].map(self.college_map)
        df_enc["branch_code_enc"] = df_enc["branch_code"].map(self.branch_map)
        df_enc["category_enc"] = df_enc["category"].map(self.cat_map)
        df_enc["quota_enc"] = df_enc["quota"].map(self.quota_map)
        df_enc["gender_enc"] = df_enc["gender"].map(self.gender_map)

        features = [
            "college_code_enc", "branch_code_enc", "category_enc", "quota_enc",
            "gender_enc", "lag_1", "lag_2"
        ]
        X = df_enc[features].copy()
        X["lag_1"] = np.log1p(X["lag_1"])
        X["lag_2"] = np.log1p(X["lag_2"])
        y = np.log1p(df_enc["closing_rank"])
        self.xgb_model.fit(X, y)
        self.lgb_model.fit(X, y)
        pred_xgb = self.xgb_model.predict(X)
        pred_lgb = self.lgb_model.predict(X)
        preds = self.xgb_weight * pred_xgb + self.lgb_weight * pred_lgb
        self.residuals = y.values - preds
        p_orig = np.expm1(preds)
        y_orig = df_enc["closing_rank"].values
        mape = float(mean_absolute_percentage_error(y_orig, p_orig))
        mae = float(mean_absolute_error(y_orig, p_orig))
        from .mlflow_tracker import log_training_run
        log_training_run(
            params={"xgb_weight": self.xgb_weight, "lgb_weight": self.lgb_weight},
            metrics={"train_mape": mape, "train_mae": mae},
            models={"xgb_model": self.xgb_model, "lgb_model": self.lgb_model},
            exam_type=exam_type
        )
        return mape, mae

    def predict_one(
        self, college_code: str, branch_code: str, category: str, quota: str,
        gender: str, lag_1: float, lag_2: float
    ) -> Tuple[float, np.ndarray]:
        """Predict the closing rank and return the bootstrap distribution."""
        # Use get fallback to avoid KeyError for any unseen values
        x_input = pd.DataFrame([{
            "college_code_enc": self.college_map.get(college_code, 0),
            "branch_code_enc": self.branch_map.get(branch_code, 0),
            "category_enc": self.cat_map.get(category, 0),
            "quota_enc": self.quota_map.get(quota, 0),
            "gender_enc": self.gender_map.get(gender, 0),
            "lag_1": np.log1p(lag_1),
            "lag_2": np.log1p(lag_2)
        }])
        p_xgb = self.xgb_model.predict(x_input)[0]
        p_lgb = self.lgb_model.predict(x_input)[0]
        pred_point = self.xgb_weight * p_xgb + self.lgb_weight * p_lgb
        np.random.seed(42)
        if len(self.residuals) == 0:
            res = np.zeros(1000)
        else:
            res = np.random.choice(self.residuals, size=1000, replace=True)
        bootstrap_preds = np.clip(np.expm1(pred_point + res), 1, None)
        return float(np.expm1(pred_point)), bootstrap_preds


class EnsembleModel(mlflow.pyfunc.PythonModel):
    """MLflow custom model wrapping the XGBoost + LightGBM ensemble."""

    def __init__(
        self,
        xgb_model: Any,
        lgb_model: Any,
        xgb_weight: float = 0.55,
        lgb_weight: float = 0.45,
        college_map: Dict[str, int] = None,
        branch_map: Dict[str, int] = None,
        cat_map: Dict[str, int] = None,
        quota_map: Dict[str, int] = None,
        gender_map: Dict[str, int] = None,
        residuals: np.ndarray = None
    ) -> None:
        self.xgb_model = xgb_model
        self.lgb_model = lgb_model
        self.xgb_weight = xgb_weight
        self.lgb_weight = lgb_weight
        self.college_map = college_map or {}
        self.branch_map = branch_map or {}
        self.cat_map = cat_map or {}
        self.quota_map = quota_map or {}
        self.gender_map = gender_map or {}
        self.residuals = residuals if residuals is not None else np.array([])

    def predict(self, context: Any, model_input: pd.DataFrame) -> pd.DataFrame:
        """Required predict implementation for MLflow PyFunc model."""
        preds = []
        for _, row in model_input.iterrows():
            pred_point, _ = self.predict_one(
                str(row["college_code"]),
                str(row["branch_code"]),
                str(row["category"]),
                str(row["quota"]),
                str(row["gender"]),
                float(row["lag_1"]),
                float(row["lag_2"])
            )
            preds.append(pred_point)
        return pd.DataFrame({"predicted_closing_rank": preds})

    def predict_one(
        self, college_code: str, branch_code: str, category: str, quota: str,
        gender: str, lag_1: float, lag_2: float
    ) -> Tuple[float, np.ndarray]:
        """Predict the closing rank and return the bootstrap distribution."""
        x_input = pd.DataFrame([{
            "college_code_enc": self.college_map.get(college_code, 0),
            "branch_code_enc": self.branch_map.get(branch_code, 0),
            "category_enc": self.cat_map.get(category, 0),
            "quota_enc": self.quota_map.get(quota, 0),
            "gender_enc": self.gender_map.get(gender, 0),
            "lag_1": np.log1p(lag_1),
            "lag_2": np.log1p(lag_2)
        }])
        p_xgb = self.xgb_model.predict(x_input)[0]
        p_lgb = self.lgb_model.predict(x_input)[0]
        pred_point = self.xgb_weight * p_xgb + self.lgb_weight * p_lgb
        np.random.seed(42)
        if len(self.residuals) == 0:
            res = np.zeros(1000)
        else:
            res = np.random.choice(self.residuals, size=1000, replace=True)
        bootstrap_preds = np.clip(np.expm1(pred_point + res), 1, None)
        return float(np.expm1(pred_point)), bootstrap_preds


