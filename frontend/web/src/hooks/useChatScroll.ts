import { useEffect, useRef } from "react";

export function useChatScroll<T>(dep: T, isStreaming: boolean, messageCount: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestBotMessageRef = useRef<HTMLDivElement | null>(null);
  const latestUserMessageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // When a new assistant message appears, smoothly align to the TOP of the message
    if (latestBotMessageRef.current) {
      latestBotMessageRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [messageCount]);

  return { containerRef, latestBotMessageRef, latestUserMessageRef };
}
