"""
Training script for JEE_MAIN, NEET, and MHT_CET cutoff prediction models.
"""

import os
import logging
from typing import Dict, List, Tuple
import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
import mlflow
import mlflow.pyfunc
from sqlalchemy.orm import Session

from services.prediction.database import SessionLocal, init_db, ExamCutoff
from services.prediction.main import populate_synthetic_data
from services.prediction.model import add_lags, EnsembleModel

# Configure logger
logger: logging.Logger = logging.getLogger("prediction_service.training")
logging.basicConfig(level=logging.INFO)


def init_and_get_data(db: Session, exam_type: str) -> pd.DataFrame:
    """Initialize database and fetch cutoff data for training."""
    if db.query(ExamCutoff).count() == 0:
        logger.info("Database is empty. Populating with synthetic data...")
        populate_synthetic_data(db)

    cutoffs = db.query(ExamCutoff).filter(ExamCutoff.exam_type == exam_type).all()
    if not cutoffs:
        raise ValueError(f"No cutoff records found in database for exam {exam_type}")

    records = []
    for c in cutoffs:
        records.append(
            {
                "college_code": c.college_code,
                "branch_code": c.branch_code,
                "category": c.category,
                "quota": c.quota,
                "gender": "M",
                "year": c.year,
                "closing_rank": c.closing_rank,
            }
        )
        records.append(
            {
                "college_code": c.college_code,
                "branch_code": c.branch_code,
                "category": c.category,
                "quota": c.quota,
                "gender": "F",
                "year": c.year,
                "closing_rank": int(c.closing_rank * 1.2),
            }
        )

    return pd.DataFrame(records)


def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Calculate MAE, within 500 and within 200 accuracy metrics."""
    abs_diff = np.abs(y_true - y_pred)
    mae = float(np.mean(abs_diff))
    within_500 = float(np.mean(abs_diff <= 500))
    within_200 = float(np.mean(abs_diff <= 200))
    return {
        "mae": mae,
        "within_500_accuracy": within_500,
        "within_200_accuracy": within_200,
    }


def split_data(
    df_enc: pd.DataFrame, features: List[str]
) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame, np.ndarray]:
    """Split the encoded dataframe into training and validation sets."""
    train_df = df_enc[df_enc["year"] < 2024]
    val_df = df_enc[df_enc["year"] == 2024]
    if train_df.empty or val_df.empty:
        train_df = df_enc.sample(frac=0.8, random_state=42)
        val_df = df_enc.drop(train_df.index)

    X_train = train_df[features].copy()
    X_train["lag_1"] = np.log1p(X_train["lag_1"])
    X_train["lag_2"] = np.log1p(X_train["lag_2"])
    y_train = np.log1p(train_df["closing_rank"])

    X_val = val_df[features].copy()
    X_val["lag_1"] = np.log1p(X_val["lag_1"])
    X_val["lag_2"] = np.log1p(X_val["lag_2"])
    y_val_orig = val_df["closing_rank"].values

    return X_train, y_train, X_val, y_val_orig


def build_mappings(
    df_lags: pd.DataFrame,
) -> Tuple[
    Dict[str, int], Dict[str, int], Dict[str, int], Dict[str, int], Dict[str, int]
]:
    """Build mappings from unique values in training data."""
    col_map = {v: i for i, v in enumerate(df_lags["college_code"].unique())}
    br_map = {v: i for i, v in enumerate(df_lags["branch_code"].unique())}
    cat_map = {v: i for i, v in enumerate(df_lags["category"].unique())}
    q_map = {v: i for i, v in enumerate(df_lags["quota"].unique())}
    g_map = {v: i for i, v in enumerate(df_lags["gender"].unique())}
    return col_map, br_map, cat_map, q_map, g_map


def encode_features(
    df_lags: pd.DataFrame,
    col_map: Dict[str, int],
    br_map: Dict[str, int],
    cat_map: Dict[str, int],
    q_map: Dict[str, int],
    g_map: Dict[str, int],
) -> pd.DataFrame:
    """Encode categorical columns based on built mappings."""
    df_enc = df_lags.copy()
    df_enc["college_code_enc"] = df_enc["college_code"].map(col_map)
    df_enc["branch_code_enc"] = df_enc["branch_code"].map(br_map)
    df_enc["category_enc"] = df_enc["category"].map(cat_map)
    df_enc["quota_enc"] = df_enc["quota"].map(q_map)
    df_enc["gender_enc"] = df_enc["gender"].map(g_map)
    return df_enc


def fit_models(
    X_train: pd.DataFrame, y_train: pd.Series
) -> Tuple[xgb.XGBRegressor, lgb.LGBMRegressor]:
    """Fit XGBoost and LightGBM model regressors."""
    xgb_reg = xgb.XGBRegressor(n_estimators=100, max_depth=4, random_state=42)
    lgb_reg = lgb.LGBMRegressor(
        n_estimators=100, max_depth=4, random_state=42, verbose=-1
    )
    xgb_reg.fit(X_train, y_train)
    lgb_reg.fit(X_train, y_train)
    return xgb_reg, lgb_reg


def mlflow_logging(
    exam_type: str, metrics: Dict[str, float], ensemble_model: EnsembleModel
) -> None:
    """Log parameters, metrics, and register model to MLflow."""
    mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db"))
    mlflow.set_experiment(os.getenv("MLFLOW_EXPERIMENT_NAME", "cutoff_prediction"))
    with mlflow.start_run():
        mlflow.set_tags({"exam_type": exam_type})
        mlflow.log_params({"xgb_weight": 0.55, "lgb_weight": 0.45})
        mlflow.log_metrics(metrics)
        mlflow.pyfunc.log_model(
            artifact_path="model",
            python_model=ensemble_model,
            registered_model_name=f"cutoff_{exam_type}",
        )


def train_and_log_model(exam_type: str, df: pd.DataFrame) -> None:
    """Orchestrate encoding, model fitting, and evaluation."""
    df_lags = add_lags(df)
    col_map, br_map, cat_map, q_map, g_map = build_mappings(df_lags)
    df_enc = encode_features(df_lags, col_map, br_map, cat_map, q_map, g_map)

    features = [
        "college_code_enc",
        "branch_code_enc",
        "category_enc",
        "quota_enc",
        "gender_enc",
        "lag_1",
        "lag_2",
    ]
    X_train, y_train, X_val, y_val_orig = split_data(df_enc, features)
    xgb_reg, lgb_reg = fit_models(X_train, y_train)

    X_all = df_enc[features].copy()
    X_all["lag_1"] = np.log1p(X_all["lag_1"])
    X_all["lag_2"] = np.log1p(X_all["lag_2"])
    y_all = np.log1p(df_enc["closing_rank"])
    preds_all = 0.55 * xgb_reg.predict(X_all) + 0.45 * lgb_reg.predict(X_all)
    residuals = y_all.values - preds_all

    p_val = np.expm1(0.55 * xgb_reg.predict(X_val) + 0.45 * lgb_reg.predict(X_val))
    metrics = calculate_metrics(y_val_orig, p_val)
    logger.info(f"{exam_type} validation metrics: {metrics}")

    ensemble_model = EnsembleModel(
        xgb_model=xgb_reg,
        lgb_model=lgb_reg,
        xgb_weight=0.55,
        lgb_weight=0.45,
        college_map=col_map,
        branch_map=br_map,
        cat_map=cat_map,
        quota_map=q_map,
        gender_map=g_map,
        residuals=residuals,
    )
    mlflow_logging(exam_type, metrics, ensemble_model)


def main() -> None:
    """Main execution block to train models for JEE_MAIN, NEET, and MHT_CET."""
    init_db()
    db = SessionLocal()
    try:
        exams = ["JEE_MAIN", "NEET", "MHT_CET"]
        for exam in exams:
            logger.info(f"Starting training for {exam}...")
            df = init_and_get_data(db, exam)
            train_and_log_model(exam, df)
            logger.info(f"Finished training for {exam}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
