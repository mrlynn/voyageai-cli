# VHS demo tape for local inference with voyageai-cli
# Run: vhs docs/demos/local-inference.tape
# Requires:
#   - Ollama running locally with llama3.2:3b installed
#   - `vai nano setup` already completed
#   - No API key required

Output local-inference.gif

Set FontSize 16
Set Width 1000
Set Height 680
Set Theme "Catppuccin Mocha"
Set Padding 20

# Show version
Type "vai --version"
Enter
Sleep 1.5s

# Show local LLM availability
Type "ollama list"
Enter
Sleep 2.5s

# Configure Ollama for this shell session only
Type "export VAI_LLM_PROVIDER=ollama"
Enter
Sleep 0.5s
Type "export VAI_LLM_MODEL=llama3.2:3b"
Enter
Sleep 0.5s
Type "export VAI_LLM_BASE_URL=http://localhost:11434"
Enter
Sleep 0.5s

# Verify nano is ready for local embeddings
Type "vai nano status"
Enter
Sleep 2.5s

# Generate with the local Ollama LLM
Type 'ollama run llama3.2:3b "In 4 short lines, explain why pairing a local LLM with local embeddings is useful for CLI demos."'
Enter
Sleep 6s

# Generate local embeddings with nano
Type 'vai embed "Local inference keeps retrieval private, fast, and API-key free." --local --dimensions 256'
Enter
Sleep 4s

# Close with the built-in explainer
Type "vai explain local inference"
Enter
Sleep 5s

# Pause at end to show results
Sleep 2s
