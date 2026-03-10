---
title: "Code Search by Description"
type: example
section: "search"
difficulty: "intermediate"
---

## What You'll Build

A semantic code search system where you describe what a function does in plain English and find matching code in your codebase. Instead of grepping for function names or keywords, you search by intent -- "function that validates email addresses" finds the right code even if it is named `checkInput`.

## The Scenario

You have a Node.js project with 100+ source files. A new developer needs to find the authentication middleware but does not know it is called `ensureAuth.js`. Traditional search requires knowing the right keywords. Semantic code search lets them describe what they are looking for in natural language.

## Implementation

Use vai's dedicated code search command to index your codebase:

```bash
vai code-search --dir ./src --query "email validation function"
```

For a more persistent setup, embed your code files and store them in MongoDB:

```bash
vai ingest --dir ./src --db codebase --collection source --model voyage-code-3
```

The `voyage-code-3` model is specifically trained for code retrieval and understands programming concepts across languages. Create the search index:

```bash
vai index create --db codebase --collection source --field embedding --dimensions 1024
```

Now search by description:

```bash
vai search --query "middleware that checks if user is authenticated" --db codebase --collection source --limit 5
```

Try more searches:

```bash
vai search --query "function that connects to the database" --db codebase --collection source --limit 5
vai search --query "error handling for API responses" --db codebase --collection source --limit 5
```

## Expected Results

The authentication middleware file should appear in the top results for the first query, regardless of its filename or internal naming conventions. Results include the file path and the matched code chunk. Similarity scores for good matches are typically above 0.75.

## Variations

Use `vai embed --file src/auth.js --model voyage-code-3` to embed a single file. Combine code search with `vai rerank` for higher precision on large codebases. Try `voyage-4-large` instead of `voyage-code-3` for mixed code-and-documentation repositories where you need both code and prose results.
