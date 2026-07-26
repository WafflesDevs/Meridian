"""LangSmith View-trace fields on RagResult."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch
from uuid import UUID

from app.core.rag import RagResult, _langsmith_trace_url, _tracing_enabled, rag_answer


class TraceUrlTests(unittest.TestCase):
    def test_peek_url_builder(self) -> None:
        rid = "019f9cbe-4989-7612-af23-e38b7f8d3ad9"
        self.assertEqual(
            _langsmith_trace_url(rid),
            f"https://smith.langchain.com/?peek={rid}",
        )

    def test_rag_result_includes_trace_when_tracing_on(self) -> None:
        fake_run = MagicMock()
        fake_run.id = UUID("019f9cbe-4989-7612-af23-e38b7f8d3ad9")
        fake_run.end = MagicMock()

        class _TraceCM:
            def __enter__(self):
                return fake_run

            def __exit__(self, *args):
                return False

        with (
            patch("app.core.rag._tracing_enabled", return_value=True),
            patch("app.core.rag.trace", return_value=_TraceCM()) as trace_mock,
            patch(
                "app.core.rag._invoke_agent",
                return_value=("Meridian answer", []),
            ),
            patch("app.core.rag.collect_sources", return_value=[]),
            patch("app.core.rag.settings") as settings_mock,
        ):
            settings_mock.LANGCHAIN_PROJECT = "myRAG"
            result = rag_answer("what is aspirin?")

        self.assertIsInstance(result, RagResult)
        self.assertEqual(result.answer, "Meridian answer")
        self.assertIsNotNone(result.run_id)
        self.assertEqual(result.trace_url, _langsmith_trace_url(result.run_id))
        self.assertIn("peek=", result.trace_url)
        trace_mock.assert_called_once()
        self.assertEqual(trace_mock.call_args.kwargs.get("run_id"), result.run_id)

    def test_rag_result_omits_trace_when_tracing_off(self) -> None:
        with (
            patch("app.core.rag._tracing_enabled", return_value=False),
            patch(
                "app.core.rag._invoke_agent",
                return_value=("offline answer", []),
            ),
            patch("app.core.rag.collect_sources", return_value=[]),
            patch("app.core.rag.trace") as trace_mock,
        ):
            result = rag_answer("hello")

        self.assertEqual(result.answer, "offline answer")
        self.assertIsNone(result.run_id)
        self.assertIsNone(result.trace_url)
        trace_mock.assert_not_called()

    def test_tracing_enabled_requires_key_and_flag(self) -> None:
        with patch("app.core.rag.settings") as s:
            s.LANGCHAIN_TRACING_V2 = True
            s.LANGCHAIN_API_KEY = "lsv2_test"
            self.assertTrue(_tracing_enabled())
            s.LANGCHAIN_API_KEY = None
            self.assertFalse(_tracing_enabled())
            s.LANGCHAIN_TRACING_V2 = False
            s.LANGCHAIN_API_KEY = "lsv2_test"
            self.assertFalse(_tracing_enabled())


if __name__ == "__main__":
    unittest.main()
