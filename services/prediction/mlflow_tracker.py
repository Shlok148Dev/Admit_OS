"""
MLflow experiment tracking module for cutoff prediction training runs.
"""

import os
import logging
from typing import Any, Dict

# Enable filesystem tracking backend for MLflow
os.environ["MLFLOW_ALLOW_FILE_STORE"] = "true"

import mlflow

logger: logging.Logger = logging.getLogger("prediction_service.mlflow_tracker")

MLFLOW_TRACKING_URI: str = os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db")
MLFLOW_EXPERIMENT_NAME: str = os.getenv("MLFLOW_EXPERIMENT_NAME", "cutoff_prediction")

def setup_mlflow() -> None:
    """Set up MLflow tracking URI and experiment."""
    try:
        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        mlflow.set_experiment(MLFLOW_EXPERIMENT_NAME)
        logger.info(
            f"MLflow initialized. URI: {MLFLOW_TRACKING_URI}, "
            f"Experiment: {MLFLOW_EXPERIMENT_NAME}"
        )
    except Exception as e:
        logger.error(f"Failed to initialize MLflow: {e}", exc_info=True)

def log_training_run(
    params: Dict[str, Any],
    metrics: Dict[str, float],
    models: Dict[str, Any],
    exam_type: str = "JEE_MAIN"
) -> None:
    """Log parameters, metrics, and models of a training run to MLflow."""
    setup_mlflow()
    try:
        with mlflow.start_run() as run:
            # Log tags on the run
            mlflow.set_tags({"exam_type": exam_type})
            mlflow.log_params(params)
            mlflow.log_metrics(metrics)
            
            for name, model in models.items():
                model_name = f"{exam_type}_{name}"
                if "xgb" in name.lower():
                    mlflow.xgboost.log_model(model, artifact_path=name, registered_model_name=model_name)
                elif "lgb" in name.lower():
                    mlflow.lightgbm.log_model(model, artifact_path=name, registered_model_name=model_name)
                else:
                    mlflow.sklearn.log_model(model, artifact_path=name, registered_model_name=model_name)
                
                # Tag the model version in the registry
                try:
                    from mlflow.tracking import MlflowClient
                    client = MlflowClient()
                    latest_versions = client.get_latest_versions(model_name, stages=["None", "Staging", "Production"])
                    if latest_versions:
                        latest_ver = latest_versions[0].version
                        client.set_model_version_tag(model_name, latest_ver, "exam_type", exam_type)
                        logger.info(f"Registered model {model_name} version {latest_ver} tagged with exam_type: {exam_type}")
                except Exception as reg_err:
                    logger.warning(f"Could not set registry tag for {model_name}: {reg_err}")
            
            logger.info("Successfully logged training run to MLflow.")
    except Exception as e:
        logger.error(f"Error during MLflow logging: {e}", exc_info=True)

