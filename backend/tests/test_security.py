import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.security import create_access_token, decode_access_token


class SecurityTokenTests(unittest.TestCase):
    def test_token_round_trip(self):
        with patch.dict(os.environ, {"AUTH_JWT_SECRET": "a-secure-test-secret-with-32-characters"}, clear=False):
            token, expires_in = create_access_token("user-123")
            claims = decode_access_token(token)
        self.assertEqual(claims["sub"], "user-123")
        self.assertGreater(expires_in, 0)

    def test_rejects_tampered_token(self):
        with patch.dict(os.environ, {"AUTH_JWT_SECRET": "a-secure-test-secret-with-32-characters"}, clear=False):
            token, _ = create_access_token("user-123")
            header, payload, signature = token.split(".")
            tampered_signature = ("a" if signature[0] != "a" else "b") + signature[1:]
            tampered = f"{header}.{payload}.{tampered_signature}"
            with self.assertRaises(HTTPException) as context:
                decode_access_token(tampered)
        self.assertEqual(context.exception.status_code, 401)

    def test_requires_long_signing_secret(self):
        with patch.dict(os.environ, {"AUTH_JWT_SECRET": "short"}, clear=False):
            with self.assertRaises(HTTPException) as context:
                create_access_token("user-123")
        self.assertEqual(context.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
