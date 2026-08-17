import logging
import os
from typing import List, Dict, Optional

logger = logging.getLogger("notification_service.fcm")

try:
    import firebase_admin
    from firebase_admin import credentials, messaging

    HAS_FIREBASE = True
except ImportError:
    HAS_FIREBASE = False


class FCMSender:
    """FCMSender class to send single and batch push notifications via Firebase Cloud Messaging."""

    def __init__(self, credentials_path: Optional[str] = None) -> None:
        """Initializes the Firebase Admin SDK or falls back to stub mode."""
        self.enabled = HAS_FIREBASE
        if not self.enabled:
            logger.warning("firebase-admin is not installed. Running in FCM stub mode.")
            return

        try:
            if not firebase_admin._apps:
                if credentials_path and os.path.exists(credentials_path):
                    cred = credentials.Certificate(credentials_path)
                    firebase_admin.initialize_app(cred)
                else:
                    firebase_admin.initialize_app()
            logger.info("Firebase Admin App initialized successfully.")
        except Exception as e:
            logger.error("Failed to initialize Firebase: %s. Using stub mode.", str(e))
            self.enabled = False

    def send_to_token(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> str:
        """Sends a notification to a single device token."""
        if not self.enabled:
            logger.info("FCM stub: Sent to token (body length: %d)", len(body))
            return "mock_msg_id"

        try:
            msg = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data=data,
                token=token,
            )
            return messaging.send(msg)
        except Exception as e:
            logger.error("FCM single send failure: %s", str(e))
            return ""

    def send_to_topic(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> str:
        """Sends a notification to a topic subscription."""
        if not self.enabled:
            logger.info(
                "FCM stub: Sent to topic %s (body length: %d)", topic, len(body)
            )
            return "mock_topic_msg_id"

        try:
            msg = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data=data,
                topic=topic,
            )
            return messaging.send(msg)
        except Exception as e:
            logger.error("FCM topic send failure: %s", str(e))
            return ""

    def send_batch(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> List[str]:
        """Sends a notification to a batch of device tokens in chunks of 500."""
        if not self.enabled:
            logger.info(
                "FCM stub: Sent batch of %d (body length: %d)", len(tokens), len(body)
            )
            return ["mock_msg_id"] * len(tokens)

        message_ids: List[str] = []
        for i in range(0, len(tokens), 500):
            chunk = tokens[i : i + 500]
            messages = [
                messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data=data,
                    token=t,
                )
                for t in chunk
            ]
            try:
                batch_response = messaging.send_each(messages)
                for resp in batch_response.responses:
                    message_ids.append(resp.message_id if resp.success else "")
            except Exception as e:
                logger.error("FCM batch send failure: %s", str(e))
                message_ids.extend([""] * len(chunk))
        return message_ids

    def subscribe_to_topic(self, tokens: List[str], topic: str) -> bool:
        """Subscribes a list of tokens to a specific FCM topic."""
        if not self.enabled:
            logger.info("FCM stub: Subscribed %d tokens to %s", len(tokens), topic)
            return True

        try:
            for i in range(0, len(tokens), 1000):
                chunk = tokens[i : i + 1000]
                messaging.subscribe_to_topic(chunk, topic)
            return True
        except Exception as e:
            logger.error("FCM subscribe to topic failure: %s", str(e))
            return False

    def unsubscribe_from_topic(self, tokens: List[str], topic: str) -> bool:
        """Unsubscribes a list of tokens from a specific FCM topic."""
        if not self.enabled:
            logger.info("FCM stub: Unsubscribed %d tokens from %s", len(tokens), topic)
            return True

        try:
            for i in range(0, len(tokens), 1000):
                chunk = tokens[i : i + 1000]
                messaging.unsubscribe_from_topic(chunk, topic)
            return True
        except Exception as e:
            logger.error("FCM unsubscribe from topic failure: %s", str(e))
            return False
