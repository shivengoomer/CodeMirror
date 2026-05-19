"""LeetCode auth bootstrap placeholders.

LeetCode does not expose a public OAuth provider. The browser extension captures
LeetCode session cookies and the backend stores them encrypted as an OAuth-like
activation flow.
"""


def build_leetcode_activation_url() -> str:
    return "https://leetcode.com/accounts/login/"
