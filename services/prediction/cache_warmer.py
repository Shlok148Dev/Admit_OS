"""
Cache warmer for ADMIT OS Prediction Service.
Runs on startup to pre-warm the Redis cache with the top 1,000 queries.
"""

import logging
from sqlalchemy import text
from services.prediction.database import SessionLocal
from services.prediction.schemas import CollegePredictionRequest, ExamEnum, CategoryEnum, GenderEnum
from services.prediction.cache import set_cached_prediction

logger = logging.getLogger("prediction_service.cache_warmer")

def warm_cache() -> None:
    """Pre-warm Redis cache with top 1,000 queries from prediction_logs."""
    logger.info("Starting cache warmer...")
    
    # Import main modules locally to prevent circular imports during startup
    from services.prediction.main import run_prediction_pipeline, generate_cache_key, make_prediction_response

    db = SessionLocal()
    try:
        # Fetch top 1,000 queries grouped by exam_type, category, gender, and rank
        query = text("""
            SELECT exam_type, category, gender, rank, COUNT(*) as query_count
            FROM prediction_logs
            GROUP BY exam_type, category, gender, rank
            ORDER BY query_count DESC
            LIMIT 1000
        """)
        results = db.execute(query).fetchall()
        logger.info(f"Cache warmer retrieved {len(results)} popular queries from prediction_logs.")
        
        warmed_count = 0
        for row in results:
            exam_str, category_str, gender_str, rank, _ = row
            try:
                # Safely map string values to Enums
                exam = ExamEnum(exam_str)
                category = CategoryEnum(category_str)
                gender = GenderEnum(gender_str)
                
                # Determine home state and calculate synthetic percentile
                home_state = "MH" if exam_str == "MHT_CET" else "OS"
                percentile = max(0.0, min(100.0, 100.0 - (rank / 500.0)))
                
                request = CollegePredictionRequest(
                    exam=exam,
                    rank=rank,
                    percentile=percentile,
                    category=category,
                    home_state=home_state,
                    gender=gender,
                    year=2025,
                    filters=None
                )
                
                predictions = run_prediction_pipeline(request, db)
                response = make_prediction_response(predictions)
                
                cache_key = generate_cache_key(request)
                set_cached_prediction(cache_key, response.model_dump())
                warmed_count += 1
            except Exception as ex:
                logger.error(f"Error warming cache for query {row}: {ex}")
                
        logger.info(f"Cache warmer finished. Pre-warmed {warmed_count} prediction queries.")
    except Exception as e:
        logger.error(f"Cache warmer encountered an error: {e}", exc_info=True)
    finally:
        db.close()
