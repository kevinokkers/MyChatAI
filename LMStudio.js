

    // --- Model list ---
    async function loadModels() {
      modelSel.innerHTML = '<option>Loading…</option>';
      status.textContent = 'Connecting to LM Studio…';

      let base = getServerBase();
      let data = null;

      try {
        data = await fetchModelsFromUrl(base);
      } catch (err) {
        // Smart fallback: try switching between 1235 and 1234
        const fallback = base.includes(":1234")
          ? base.replace(":1234", ":1235")
          : base.includes(":1235")
            ? base.replace(":1235", ":1234")
            : null;

        if (fallback) {
          try {
            data = await fetchModelsFromUrl(fallback);
            base = fallback;
            serverUrlInput.value = base;
            localStorage.setItem("lmstudio_server_url", base);
          } catch (_) {
            // Keep original error if fallback also failed
          }
        }

        if (!data) {
          modelSel.innerHTML = '<option>Failed to load models</option>';
          status.textContent = `Model list error from ${base}: ${err.message}. Ensure LM Studio local server is started.`;
          return;
        }
      }

      try {
        const llms = (data.models || []).filter(m => m.type === "llm");
        modelSel.innerHTML = "";
        if (!llms.length) {
          modelSel.innerHTML = '<option>No LLM models found</option>';
          status.textContent = `Connected to ${base}, but no LLM models were returned.`;
          return;
        }

        let selectedKey = null;
        for (const m of llms) {
          const opt = document.createElement("option");
          opt.value = m.key;
          const isLoaded = Array.isArray(m.loaded_instances) && m.loaded_instances.length > 0;
          opt.textContent = `${m.display_name || m.key}${isLoaded ? " (Loaded)" : ""}`;
          if (isLoaded && !selectedKey) {
            selectedKey = m.key;
          }
          modelSel.appendChild(opt);
        }

        if (selectedKey) {
          modelSel.value = selectedKey;
        }

        status.textContent = `Connected to ${base} (${llms.length} model${llms.length === 1 ? "" : "s"} found)`;
      } catch (e) {
        modelSel.innerHTML = '<option>Failed to load models</option>';
        status.textContent = `Model list parse error: ${e.message}`;
      }
    }
   

    async function fetchModelsFromUrl(base) {
      const res = await fetch(`${base}/api/v1/models`);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    }
    

    async function send() {
      const text = input.value.trim();
      if (!text) return;

      const model = modelSel.value;
      if (!model || model.startsWith("Failed") || model.startsWith("Loading") || model.startsWith("No LLM")) {
        status.textContent = "Please select a valid model first.";
        return;
      }

      const base = getServerBase();
      input.value = "";
      addMsg("user", `You: ${text}`);
      status.textContent = "Waiting for response…";
      sendBtn.disabled = true;

      var body = {
        model: model,
        input: text,
        context_length: 8000,
        stream: this.streamData
      };
      if (!statelessEnabled.checked && last_response_id) {
          body.previous_response_id = last_response_id;
        }
      if (mcpEnabled.checked) {
        body.integrations = integrations;
      }

      try {
        const res = await fetch(`${base}/api/v1/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        last_response_id = data.response_id || null;

        if (data.error) {
          throw new Error(data.error.message || JSON.stringify(data.error));
        }

        // Render output items (messages, tool calls, reasoning)
        if (Array.isArray(data.output)) {
          for (const item of data.output) {
            if (item.type === "tool_call") {
              const args = JSON.stringify(item.arguments, null, 2);
              addMsg("tool", `🔧 Tool: ${item.tool}\n   Args: ${args}\n   Result: ${String(item.output).slice(0, 300)}`);
            } else if (item.type === "reasoning") {
              addMsg("reasoning", `💭 Reasoning:\n${item.content}`);
            } else if (item.type === "message") {
              const msgText = `${item.content}`;
              addMsg("assistant", msgText);
              // Auto-speak if toggle is enabled
              if (document.getElementById("tts-enabled").checked) {
                setTimeout(() => speakText(msgText, null), 100);
              }
            }
          }
        }

        // Stats
        if (data.stats) {
          const s = data.stats;
          addMsg("stats",
            `⏱ ${s.time_to_first_token_seconds?.toFixed(2)}s TTFT · ` +
            `${s.tokens_per_second?.toFixed(1)} tok/s · ` +
            `${s.input_tokens} in / ${s.total_output_tokens} out`
          );
        }

        status.textContent = "";
      } catch (err) {
        status.textContent = `Error: ${err.message}`;
      } finally {
        sendBtn.disabled = false;
      }
    }