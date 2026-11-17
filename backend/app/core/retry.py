import asyncio
import logging
import random
from typing import Any, Callable, Coroutine, TypeVar
import openai

logger = logging.getLogger(__name__)

T = TypeVar("T")

RETRYABLE_OPENAI_ERRORS = (
    openai.RateLimitError,
    openai.APIConnectionError,
    openai.APITimeoutError,
    openai.InternalServerError,
)


async def call_with_retry(
    coroutine_func: Callable[[], Coroutine[Any, Any, T]],
    max_retries: int = 4,
    initial_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    jitter: bool = True,
    operation_name: str = "OpenAI API call",
) -> T:
    """
    Executes an async OpenAI API call with exponential backoff and jitter.
    Retries on 429 RateLimitError, connection errors, timeouts, and 5xx internal errors.
    """
    attempt = 0
    delay = initial_delay

    while True:
        try:
            return await coroutine_func()
        except RETRYABLE_OPENAI_ERRORS as exc:
            attempt += 1
            if attempt > max_retries:
                logger.error(
                    f"[{operation_name}] Exhausted {max_retries} retries. Raising: {exc}"
                )
                raise exc

            # Calculate backoff delay with optional jitter
            sleep_time = min(delay, max_delay)
            if jitter:
                sleep_time += random.uniform(0.1, 0.9)

            logger.warning(
                f"[{operation_name}] Transient error on attempt {attempt}/{max_retries}: {exc}. "
                f"Retrying in {sleep_time:.2f}s..."
            )
            await asyncio.sleep(sleep_time)
            delay *= backoff_factor
        except Exception as exc:
            # Non-retryable error (e.g., AuthenticationError, BadRequestError)
            logger.error(f"[{operation_name}] Non-retryable error: {exc}")
            raise exc
