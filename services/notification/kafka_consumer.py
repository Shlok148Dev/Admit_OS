import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from services.notification.config import settings
from services.notification.models import (
    DeviceToken,
    NotificationLog,
    NotificationPreference,
    NotificationSubscription,
    NotificationTemplate,
    StudentProfile,
)

logger = logging.getLogger("notification_service.kafka")


class GroundTruthConsumer:
    """Consumer class to process incoming Kafka messages and dispatch push notifications."""

    def __init__(self, db_factory: Any) -> None:
        """Initializes the database session factory and FCM/APNs senders."""
        self.db_factory = db_factory
        from services.notification.push.apns_sender import APNsSender
        from services.notification.push.fcm_sender import FCMSender

        self.fcm_sender = FCMSender()
        self.apns_sender = APNsSender()

    def process_message(self, message_value: str) -> None:
        """Processes a single Kafka message from ground truth topic."""
        try:
            data = json.loads(message_value)
        except Exception as e:
            logger.error("Failed to parse Kafka message JSON: %s", str(e))
            return

        if not data.get("exam"):
            logger.warning("Message missing 'exam' field.")
            return

        db = self.db_factory()
        try:
            self._process_parsed_data(db, data)
        except Exception as e:
            db.rollback()
            logger.error("Error processing ground truth message: %s", str(e))
        finally:
            db.close()

    def _process_parsed_data(self, db: Session, data: Dict[str, Any]) -> None:
        """Identifies users, templates and schedules notifications."""
        exam = data["exam"]
        year = data.get("year")
        round_num = data.get("round")

        sub_users = (
            db.query(NotificationSubscription.user_id)
            .filter(NotificationSubscription.exam_type == exam)
            .all()
        )
        prof_users = (
            db.query(StudentProfile.user_id)
            .filter(StudentProfile.primary_exam == exam)
            .all()
        )
        user_ids = {u.user_id for u in sub_users} | {u.user_id for u in prof_users}

        if not user_ids:
            logger.info("No registered users found for exam %s.", exam)
            return

        tpl = (
            db.query(NotificationTemplate)
            .filter(NotificationTemplate.template_key == "new_data_available")
            .first()
        )
        if not tpl:
            logger.error("Template 'new_data_available' not found.")
            return

        vars_dict = {
            "exam_type": exam,
            "year": str(year),
            "round_number": str(round_num),
        }
        push_users = []
        for uid in user_ids:
            pid = self._create_user_notification(db, uid, tpl, exam, vars_dict)
            if pid:
                push_users.append(pid)
        db.commit()

        if push_users and tpl.channel == "PUSH":
            self._dispatch_push(db, push_users, tpl, exam, vars_dict)

    def _create_user_notification(
        self,
        db: Session,
        user_id: int,
        template: NotificationTemplate,
        exam: str,
        variables: Dict[str, str],
    ) -> Optional[int]:
        """Creates a NotificationLog entry and returns user_id if channel is PUSH."""
        prefs = (
            db.query(NotificationPreference)
            .filter(NotificationPreference.user_id == user_id)
            .first()
        )
        if prefs and not prefs.channels.get(template.channel, True):
            return None

        now = datetime.utcnow()
        log = NotificationLog(
            user_id=user_id,
            channel=template.channel,
            template_id=template.template_key,
            variables=variables,
            exam_relevance=exam,
            created_at=now,
        )
        if template.priority == "CRITICAL":
            log.status = "SENT"
            log.sent_at = now
        elif template.priority == "HIGH":
            log.status = "QUEUED_HIGH"
        else:
            log.status = "QUEUED_NORMAL"

        db.add(log)
        return user_id

    def _dispatch_push(
        self,
        db: Session,
        user_ids: List[int],
        template: NotificationTemplate,
        exam: str,
        variables: Dict[str, str],
    ) -> None:
        """Renders titles/bodies and dispatches push notifications to tokens and topics."""
        from services.notification.main import render_text

        title = render_text(template.title_template, variables)
        body = render_text(template.body_template, variables)

        tokens = (
            db.query(DeviceToken)
            .filter(DeviceToken.user_id.in_(user_ids), DeviceToken.is_active == True)
            .all()
        )

        fcm_t = [t.token for t in tokens if t.platform != "ios"]
        apns_t = [t.token for t in tokens if t.platform == "ios"]

        if fcm_t:
            self.fcm_sender.send_batch(fcm_t, title, body)
        if apns_t:
            self.apns_sender.send_batch(apns_t, title, body)

        topic_name = f"exam_{exam.lower()}"
        self.fcm_sender.send_to_topic(topic_name, title, body)


def _get_kafka_consumer(stop_event: Optional[Any]) -> Optional[Any]:
    """Tries to initialize confluent_kafka Consumer or waits and returns None."""
    try:
        from confluent_kafka import Consumer

        conf = {
            "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "group.id": settings.KAFKA_GROUP_ID,
            "auto.offset.reset": "earliest",
        }
        return Consumer(conf)
    except ImportError:
        logger.warning("confluent-kafka not installed. Running in mock consumer mode.")
        if stop_event:
            stop_event.wait()
    except Exception as e:
        logger.error("Failed to create Kafka consumer: %s.", str(e))
        if stop_event:
            stop_event.wait()
    return None


def _run_consumer_loop(
    consumer: Any, processor: GroundTruthConsumer, stop_event: Optional[Any]
) -> None:
    """Executes the polling loop for the consumer."""
    try:
        from confluent_kafka import KafkaError
    except ImportError:
        return

    while stop_event is None or not stop_event.is_set():
        msg = consumer.poll(timeout=1.0)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                continue
            logger.error("Kafka error: %s", msg.error())
            break
        processor.process_message(msg.value().decode("utf-8"))


def run_consumer(stop_event: Optional[Any] = None) -> None:
    """Starts the consumer process thread."""
    consumer = _get_kafka_consumer(stop_event)
    if not consumer:
        return
    consumer.subscribe(["data.validated.ground_truth"])
    from services.notification.db import SessionLocal

    processor = GroundTruthConsumer(SessionLocal)
    try:
        _run_consumer_loop(consumer, processor, stop_event)
    except Exception as e:
        logger.error("Kafka consumer run loop exception: %s", str(e))
    finally:
        consumer.close()
