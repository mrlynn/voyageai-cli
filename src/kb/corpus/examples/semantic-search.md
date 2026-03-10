---
title: "Semantic Search over FAQ Documents"
type: example
section: "search"
difficulty: "beginner"
---

## What You'll Build

A searchable FAQ system where users ask natural-language questions and get answers even when their wording does not match the original FAQ text. You will embed a set of FAQ entries, store them in MongoDB Atlas, and run semantic searches that find answers based on meaning rather than keywords.

## The Scenario

You have a product FAQ with 50 entries. Users ask questions in their own words -- "how do I reset my password?" should match an FAQ titled "Account Recovery Steps" even though they share no keywords. Traditional keyword search fails here. Semantic search solves this by matching meaning.

## Implementation

First, create a directory of FAQ entries as text files, one per file:

```bash
mkdir faqs
echo "To recover your account, go to Settings > Security > Reset Password. You will receive a verification email." > faqs/account-recovery.txt
echo "Our API rate limit is 1000 requests per minute for free tier and 10000 for paid plans." > faqs/rate-limits.txt
echo "Data is encrypted at rest using AES-256 and in transit using TLS 1.3." > faqs/encryption.txt
```

Ingest the FAQ directory into MongoDB:

```bash
vai ingest --dir ./faqs --db support --collection faq --model voyage-4-lite
```

Create a vector search index:

```bash
vai index create --db support --collection faq --field embedding --dimensions 1024
```

Now search with natural language:

```bash
vai search --query "how do I reset my password?" --db support --collection faq --limit 3
```

## Expected Results

The account recovery FAQ should appear as the top result even though "reset my password" does not appear in the original text. The similarity score should be above 0.8. Results include the matched text and source file metadata.

Try another query with different wording:

```bash
vai search --query "is my data secure?" --db support --collection faq --limit 3
```

The encryption FAQ should rank highest, demonstrating how semantic search understands intent rather than matching keywords.

## Variations

Use `voyage-4-large` instead of `voyage-4-lite` for slightly better retrieval quality. Add `--filter '{"category": "security"}'` to narrow results by metadata. Combine with `vai rerank` for higher precision on larger FAQ collections.
