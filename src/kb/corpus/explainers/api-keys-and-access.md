---
title: "API Keys and Access"
type: explainer
section: api-usage
difficulty: beginner
---

## Getting Your API Key

To use Voyage AI models, you need a Model API Key from MongoDB Atlas. This is different from Atlas API keys (which manage infrastructure) and connection strings (which connect to your cluster). To create one: log in to MongoDB Atlas at cloud.mongodb.com, navigate to AI Models in the left sidebar, click Create API Key, and copy the key. It starts with `pa-` and is shown only once. There is a generous free tier -- 200 million tokens across most models with no credit card required.

## Two Access Methods

There are two ways to access Voyage AI models. The recommended path for vai users is through MongoDB Atlas at `https://ai.mongodb.com/v1/`, using a Model API Key from the Atlas dashboard. This integrates with your Atlas billing, gives you native pairing with Atlas Vector Search, and is what vai uses by default. Alternatively, you can use the Voyage AI platform directly at `https://api.voyageai.com/v1/` with a key from `dash.voyageai.com`. Both endpoints serve the same models with the same quality -- the difference is billing and dashboard.

## Configuring vai

```bash
vai config set api-key "your-key"            # store your API key
vai ping                                      # verify it works
vai config set base-url https://api.voyageai.com/v1/  # switch to Voyage AI direct (optional)
```

The default base URL is `https://ai.mongodb.com/v1/`. You only need to change it if you want to use the Voyage AI platform directly instead of the Atlas endpoint.

## Tips and Gotchas

Never commit API keys to git -- use environment variables or `vai config set`. Use `echo "key" | vai config set api-key --stdin` to avoid the key appearing in your shell history. Rotate keys periodically in the Atlas dashboard. Rate limits apply per key, so check the Atlas dashboard for your current usage. If you are hitting rate limits during batch processing, add delays between batches or request a limit increase. The free tier is per-account, not per-key, so creating multiple keys does not multiply your free tokens.
