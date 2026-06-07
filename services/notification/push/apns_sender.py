import logging
from typing import List, Dict, Optional

logger = logging.getLogger("notification_service.apns")


class APNsSender:
    """Stub implementation for APNs (Apple Push Notification service) sender."""

    def __init__(self) -> None:
        """Initializes the APNs stub sender."""
        logger.info("APNs Sender initialized in stub mode.")

    def send_to_token(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> bool:
        """Stubs sending a push notification to a single iOS device token.

        Args:
            token: The device token to send to.
            title: The title of the notification.
            body: The body of the notification.
            data: Additional key-value payload.

        Returns:
            bool: True indicating successful delivery (stub).
        """
        logger.info("APNs stub: Dispatched push notification (length: %d)", len(body))
        return True

    def send_batch(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> List[bool]:
        """Stubs sending push notifications to a batch of iOS device tokens.

        Args:
            tokens: List of device tokens.
            title: The title of the notification.
            body: The body of the notification.
            data: Additional key-value payload.

        Returns:
            List[bool]: List of flags indicating success status for each token.
        """
        logger.info("APNs stub: Dispatched batch of %d push notifications", len(tokens))
        return [True] * len(tokens)
