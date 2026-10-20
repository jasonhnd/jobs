"""Confidentiality and extraction checks for the offline archive utility."""

import io
import json
import tarfile
import unittest

from scoring_archive import Redactor, digest, pack, scores_from_text


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.redactor = Redactor(["ExamplePrivateAccount"])
        self.score = {"id": 1, "ai_risk": 4.0, "rationale_ja": "理由", "confidence": 0.8,
                      "aiois": {"d1": 1.0, "d2": 7.0}}

    def test_redacts_paths_emails_tokens_and_case_insensitive_accounts(self):
        values = ["/" + "Users" + "/example/project", "/" + "home" + "/example/project",
                  "/" + "private" + "/var/example", "example" + "@" + "example.invalid",
                  "sk" + "-" + "ExampleSecret", "xai" + "-" + "ExampleSecret",
                  "ghp" + "_" + "ExampleSecret", "Bearer" + " " + "ExampleSecret",
                  "AK" + "IA" + "0123456789ABCDEF", "EXAMPLEPRIVATEACCOUNT"]
        for value in values:
            with self.subTest(value_index=values.index(value)):
                self.assertTrue(self.redactor.hits(value))
                sanitized = self.redactor.text(value)
                self.assertNotEqual(value, sanitized)
                self.assertFalse(self.redactor.hits(sanitized))

    def test_removes_sensitive_json_fields_without_changing_scores(self):
        value = {"operator": "some-person", "nested": {"access_token": "opaque-value"},
                 "score": self.score, "user_id": None}
        sanitized = self.redactor.value(value)
        self.assertEqual(sanitized["operator"], "__REDACTED_FIELD__")
        self.assertEqual(sanitized["nested"]["access_token"], "__REDACTED_FIELD__")
        self.assertEqual(sanitized["score"], self.score)
        self.assertIsNone(sanitized["user_id"])

    def test_extracts_only_answers_from_retry_text(self):
        raw = ("progress\n--- attempt 2 ---\n" + json.dumps({**self.score, "sessionId": "private"})
               + "\ntransport failed\n--- attempt 3 ---\n" + json.dumps(self.score))
        self.assertEqual(scores_from_text(raw), [self.score, self.score])

    def test_empty_and_failure_records_are_not_answers(self):
        for raw in ("", "PENDING", '{"error":"provider failed"}', '{"id":1}', '{"id":'):
            self.assertEqual(scores_from_text(raw), [])

    def test_scan_catches_encoded_sensitive_values(self):
        local_path = "/" + "Users" + "/example/project"
        self.assertTrue(self.redactor.hits(local_path.replace("/", "\\/")))
        self.assertTrue(self.redactor.hits(local_path.replace("/", "%2F")))
        self.assertTrue(self.redactor.hits(local_path.replace("/", "\\u002f")))

    def test_archive_has_reproducible_bytes_neutral_metadata_and_hashes(self):
        members = {"answers/1.jsonl": (json.dumps(self.score) + "\n").encode()}
        manifest = {"files": [{"member": name, "bytes": len(data), "sha256": digest(data)}
                              for name, data in members.items()]}
        archive = pack(members, manifest)
        self.assertEqual(archive, pack(members, manifest))
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
            self.assertEqual(tar.getnames(), ["MANIFEST.json", "answers/1.jsonl"])
            for member in tar.getmembers():
                self.assertTrue(member.isfile())
                self.assertEqual((member.uid, member.gid, member.uname, member.gname, member.mtime),
                                 (0, 0, "", "", 0))
            self.assertEqual(tar.extractfile("answers/1.jsonl").read(), members["answers/1.jsonl"])


if __name__ == "__main__":
    unittest.main()
