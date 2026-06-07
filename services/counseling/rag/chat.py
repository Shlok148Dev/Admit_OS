"""ARIAChatEngine — services/counseling/rag/chat.py.

AI counseling assistant chat engine utilizing retrieved context
chunks and LLM API (Anthropic Claude or Groq).
"""

from __future__ import annotations

import logging
import os
from typing import List, Dict, Any, Optional

from services.counseling.schemas import ChatResponse
from services.counseling.rag.retriever import CounselingRetriever
from services.counseling.rag.guard import HallucinationGuard

logger = logging.getLogger("rag.chat")

ARIA_SYSTEM_PROMPT = """You are ARIA (Admissions & Rank Intelligent Assistant), \
the official AI counselor for ADMIT OS.
Your role is to help students navigate post-exam college admissions \
(JoSAA, CSAB, NEET MCC, MHT-CET CAP, KCET KEA, etc.).

Student Context:
- Rank: {rank}
- Category: {category}
- Home State: {home_state}
- Exam Type: {exam_type}

Guidelines:
1. Provide accurate, structured, helpful responses based ONLY on \
the provided retrieval context and student profile.
2. If the context does not contain relevant information, state \
clearly that you cannot find a reliable answer and refer to the \
official portal.
3. Keep answers concise, direct, and free of fluff.
4. Do not assume any specific college as the default choice.
5. All numeric claims must be directly supported by retrieved context.

Retrieved Context Chunks:
{context}
"""


def _detect_api_provider(api_key: str) -> str:
    """Detect LLM provider from API key prefix."""
    if api_key.startswith("sk-ant-"):
        return "anthropic"
    if api_key.startswith("gsk_"):
        return "groq"
    if api_key.startswith("sk-"):
        return "openai"
    return "unknown"


def _build_system_prompt(
    exam_type: str,
    student_context: dict,
    retrieved: list,
) -> str:
    """Build the system prompt with context."""
    rank = student_context.get("rank", "N/A")
    category = student_context.get("category", "N/A")
    home_state = student_context.get("home_state", "N/A")

    context_str = ""
    if retrieved:
        context_str = "\n".join(
            f"[Source: {c.source}, Year: {c.year}] {c.text}"
            for c, _ in retrieved
        )

    return ARIA_SYSTEM_PROMPT.format(
        rank=rank,
        category=category,
        home_state=home_state,
        exam_type=exam_type,
        context=context_str,
    )


def _format_history(history: list[dict]) -> list[dict]:
    """Format and clean message history for LLM APIs."""
    recent = history[-10:] if history else []
    formatted: list[dict] = []
    for msg in recent:
        role = msg.get("role")
        content = msg.get("content")
        if not role and not content:
            if "user" in msg:
                role, content = "user", msg["user"]
            elif "bot" in msg:
                role, content = "assistant", msg["bot"]
            elif "assistant" in msg:
                role, content = "assistant", msg["assistant"]
        if role and content:
            role = "assistant" if role.lower() in ("bot", "assistant") else "user"
            formatted.append({"role": role, "content": content})

    # Ensure alternating user/assistant
    clean: list[dict] = []
    expected = "user"
    for msg in formatted:
        if msg["role"] == expected:
            clean.append(msg)
            expected = "assistant" if expected == "user" else "user"
        elif clean and clean[-1]["role"] == msg["role"]:
            clean[-1]["content"] += "\n" + msg["content"]
        elif msg["role"] == "user":
            clean.append(msg)
            expected = "assistant"
    return clean


def _call_groq(
    api_key: str,
    system_prompt: str,
    messages: list[dict],
) -> str:
    """Call Groq API for LLM response."""
    import json
    import urllib.request

    groq_messages = [{"role": "system", "content": system_prompt}]
    groq_messages.extend(messages)

    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "messages": groq_messages,
        "max_tokens": 1024,
        "temperature": 0.2,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]


def _call_anthropic(
    api_key: str,
    system_prompt: str,
    messages: list[dict],
) -> str:
    """Call Anthropic Claude API for LLM response."""
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    models = [
        "claude-sonnet-4-6",
        "claude-3-5-sonnet-latest",
        "claude-3-sonnet-20240229",
    ]
    last_err: Optional[Exception] = None
    for model_name in models:
        try:
            response = client.messages.create(
                model=model_name,
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
                temperature=0.2,
            )
            return response.content[0].text
        except Exception as ex:
            last_err = ex
            logger.warning("Failed with model %s: %s", model_name, ex)
    raise last_err or Exception("All Claude models failed")


class ARIAChatEngine:
    """Conversational AI engine for counseling advice."""

    def __init__(
        self,
        retriever: Optional[CounselingRetriever] = None,
        guard: Optional[HallucinationGuard] = None,
    ) -> None:
        self.retriever = retriever or CounselingRetriever()
        self.guard = guard or HallucinationGuard()

    def _build_fallback_answer(
        self,
        retrieved: list,
        top_score: float,
    ) -> ChatResponse:
        """Build a rich retrieval-only fallback response."""
        if retrieved:
            chunks = "\n\n".join(c.text for c, _ in retrieved[:3])
            answer = f"Based on official counseling guidelines:\n\n{chunks}"
        else:
            answer = (
                "I could not find a sufficiently reliable answer "
                "in my knowledge base. Please consult the official "
                "JoSAA/MCC/DTE portal for your exam."
            )

        result = self.guard.validate(answer, retrieved, top_score)
        confidence = self.retriever.get_confidence_tier(retrieved)
        if not result.accepted:
            confidence = "DECLINED"

        return ChatResponse(
            answer=result.answer,
            confidence=confidence,
            sources=result.sources,
            warning=result.warning,
        )

    def chat(
        self,
        query: str,
        history: list[dict],
        exam_type: str,
        student_context: dict,
    ) -> ChatResponse:
        """Process a counseling chat request."""
        retrieved = self.retriever.retrieve(
            query, top_k=6, exam_type=exam_type,
        )
        top_score = retrieved[0][1] if retrieved else 0.0

        # Check API key
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            api_key = os.environ.get("GROQ_API_KEY", "")
        if not api_key or api_key.startswith("your_key"):
            logger.warning("No valid API key. Retrieval-only mode.")
            return self._build_fallback_answer(retrieved, top_score)

        provider = _detect_api_provider(api_key)
        sys_prompt = _build_system_prompt(
            exam_type, student_context, retrieved,
        )
        clean_messages = _format_history(history)
        clean_messages.append({"role": "user", "content": query})

        # Call appropriate LLM
        try:
            if provider == "groq":
                llm_answer = _call_groq(
                    api_key, sys_prompt, clean_messages,
                )
            elif provider == "anthropic":
                llm_answer = _call_anthropic(
                    api_key, sys_prompt, clean_messages,
                )
            else:
                logger.warning("Unknown key format: %s", provider)
                return self._build_fallback_answer(
                    retrieved, top_score,
                )
        except Exception as e:
            logger.error("LLM API call failed: %s", e, exc_info=True)
            resp = self._build_fallback_answer(retrieved, top_score)
            resp.warning = f"AI generation failed, showing retrieved context. Error: {str(e)[:100]}"
            return resp

        # Run through HallucinationGuard
        result = self.guard.validate(llm_answer, retrieved, top_score)
        confidence = self.retriever.get_confidence_tier(retrieved)
        if not result.accepted:
            confidence = "DECLINED"

        return ChatResponse(
            answer=result.answer,
            confidence=confidence,
            sources=result.sources,
            warning=result.warning if result.warning else None,
        )
