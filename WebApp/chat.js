    const modelSel = document.getElementById("model");
    const refreshBtn = document.getElementById("refresh");
    const debugEnabled = document.getElementById("debug-enabled");
    const mcpEnabled = document.getElementById("mcp-enabled");
    const statelessEnabled = document.getElementById("stateless-enabled");
    const streamDataEnabled = document.getElementById("stream-data-enabled");
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-bar");
    const progressText = document.getElementById("progress-text");
    let last_response_id = null;
    let streamData = true;
    const mcpPanel = document.getElementById("mcp-panel");
    const integrationTypeSel = document.getElementById("integration-type");
    const configPlugin = document.getElementById("config-plugin");
    const configMcpServer = document.getElementById("config-ephemeral_mcp");
    const addIntegrationBtn = document.getElementById("add-integration");
    const integrationsListEl = document.getElementById("integrations-list");

    // Stored integrations array (built from the UI)
    let integrations = [];

    // Show/hide config panels based on selected type
    integrationTypeSel.addEventListener("change", () => {
      const val = integrationTypeSel.value;
      configPlugin.classList.toggle("open", val === "plugin");
      configMcpServer.classList.toggle("open", val === "ephemeral_mcp");
    });
    const log = document.getElementById("log");
    const input = document.getElementById("input");
    const sendBtn = document.getElementById("send");
    const micBtn = document.getElementById("mic-btn");
    const status = document.getElementById("status");
    const serverUrlInput = document.getElementById("server-url");

    // Load saved server URL preference if available
    const savedUrl = localStorage.getItem("lmstudio_server_url");
    if (savedUrl) {
      serverUrlInput.value = savedUrl;
    }

    function getServerBase() {
      return (serverUrlInput.value.trim() || "http://localhost:1235").replace(/\/+$/, "");
    }

    serverUrlInput.addEventListener("change", () => {
      localStorage.setItem("lmstudio_server_url", getServerBase());
      loadModels();
    });

    refreshBtn.addEventListener("click", loadModels);
    loadModels();

    // --- MCP toggle ---
    mcpEnabled.addEventListener("change", () => {
      mcpPanel.classList.toggle("open", mcpEnabled.checked);
    });

    // --- Debug toggle ---
    debugEnabled.addEventListener("change", () => {
      if (debugEnabled.checked) {
        console.log('Debug mode enabled');
      }
    });

    // --- Stream Data toggle ---
    streamDataEnabled.addEventListener("change", () => {
      streamData = streamDataEnabled.checked;
    });

    // --- Chat ---
    function addMsg(cls, text) {
      const div = document.createElement("div");
      div.className = `msg ${cls}`;
      div.textContent = text;
      
      // Add speak button for assistant messages
      if (cls === "assistant") {
        const btn = document.createElement("button");
        btn.className = "speak-btn";
        btn.innerHTML = "🔊";
        btn.title = "Read aloud";
        div.appendChild(btn);
        btn.onclick = () => { const msgText = btn.parentNode.firstChild.textContent; speakText(msgText, btn); };
      }
      
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

    // Streaming message helpers
    let streamingContent = null;
    let streamingDiv = null;
    let streamingSpokenIndex = 0; // Track how many chars have been spoken during streaming
    
    // Streaming reasoning helpers
    let reasoningContent = "";
    let reasoningContainer = null;

    function updateStreamingMessage(text) {
      if (!streamingDiv) {
        // Create a new assistant message div for streaming
        streamingDiv = document.createElement("div");
        streamingDiv.className = "msg assistant";
        const btn = document.createElement("button");
        btn.className = "speak-btn";
        btn.innerHTML = "🔊";
        btn.title = "Read aloud";
        // We'll update the button's click handler at the end
        streamingDiv.appendChild(btn);
        log.appendChild(streamingDiv);
      }
      // Insert/update text before the button element
      if (streamingDiv.firstChild && streamingDiv.firstChild.nodeType === Node.TEXT_NODE) {
        streamingDiv.firstChild.textContent = text;
      } else {
        const textNode = document.createTextNode(text);
        streamingDiv.insertBefore(textNode, streamingDiv.firstChild);
      }
      log.scrollTop = log.scrollHeight;
    }

    function finalizeStreamingMessage() {
      if (streamingDiv) {
        // Speak any remaining unspoken content
        if (document.getElementById("tts-enabled").checked && streamingSpokenIndex < streamingContent.length) {
          
          const speakAfterComplete = document.getElementById("speak-after-complete").checked;
          if(!isTTSSpeaking){
            if (speakAfterComplete){
              const remaining = `${streamingContent.slice(0, streamingContent.length)}`;
              speakText(remaining, null);
            }
            else{
              const remaining = `${streamingContent.slice(streamingSpokenIndex)}`;
              speakText(remaining, null);
            }            
          }
        }
        // Set up the speak button with final content
        const btn = streamingDiv.querySelector(".speak-btn");
        if (btn && streamingContent) {
          btn.onclick = () => { const msgText = btn.parentNode.firstChild.textContent; speakText(msgText, btn); };
        }
        streamingSpokenIndex = 0; // Reset for next message
        streamingDiv = null;
      }
    }

    // --- Streaming send function ---
    async function sendStreaming() {
      const base = getServerBase();
      const model = modelSel.value;
      const text = input.value.trim();
      if (!text) return;

      status.textContent = "⏳";
      streamingContent = null;
      streamingDiv = null;
      reasoningContent = "";
      reasoningContainer = null;
      progressContainer.style.display = "none";
      let reader = null, decoder = null;
      try {
        const body = {
          model,
          input: text,
          context_length: 24000,
          stream: streamData,
          "integrations": [
            {
              "type": "plugin",
              "id": "mcp/websearch"
            }
          ]
        };
        if (!statelessEnabled.checked && last_response_id) {
          body.previous_response_id = last_response_id;
        }
        if (mcpEnabled.checked) {
          body.integrations = integrations;
        }
        const headers = loadHeaders();
        const res = await fetch(`${base}/api/v1/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        reader = res.body.getReader();
        decoder = new TextDecoder("utf-8");
        let buffer = "";
        let last_response_id_local = null;
        let lastParsedMsg = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";
          for (let line of parts) {
            if (!line.trim()) continue;
            // Skip SSE event metadata lines
            if (line.startsWith("event:")) continue;
            // LM Studio SSE format: data lines start with "data:" prefix
            if (line.startsWith("data:")) line = line.slice(5).trim();
            let msg;
            try { msg = JSON.parse(line); } catch (_) {
              if (debugEnabled.checked) console.log('Failed to parse:', line);
              continue;
            }
            if (debugEnabled.checked) console.log('Parsed message type:', msg.type, msg);
            lastParsedMsg = msg;
            if (!msg.type) continue;
            
            // Handle model loading progress
            if (msg.type === "model_load.progress") {
              const progress = msg.progress || 0;
              const percent = Math.round(progress * 100);
              progressBar.style.width = `${percent}%`;
              progressText.textContent = `${percent}%`;
              progressContainer.style.display = "block";
            } else if (msg.type === "prompt_processing.progress") {
              // Handle prompt processing progress
              const progress = msg.progress || 0;
              const percent = Math.round(progress * 100);
              progressBar.style.width = `${percent}%`;
              progressText.textContent = `${percent}%`;
              progressContainer.style.display = "block";
            } else if (msg.type === "prompt_processing.end") {
              // Hide progress bar when prompt processing completes
              setTimeout(() => {
                progressContainer.style.display = "none";
                progressBar.style.width = "0%";
                progressText.textContent = "0%";
              }, 500);
            } else if (msg.type === "model_load.end") {
              // Hide progress bar when loading completes
              setTimeout(() => {
                progressContainer.style.display = "none";
                progressBar.style.width = "0%";
                progressText.textContent = "0%";
              }, 500);
            }
            
            // Handle reasoning streaming
            if (msg.type === "reasoning.delta" && msg.content !== undefined) {
              if (!reasoningContainer) {
                // Create collapsible reasoning container
                reasoningContainer = document.createElement("div");
                reasoningContainer.className = "reasoning-container";
                
                // Content div (declare before event listener)
                const contentDiv = document.createElement("div");
                contentDiv.className = "reasoning-content";
                
                // Toggle button
                const toggleBtn = document.createElement("button");
                toggleBtn.className = "reasoning-toggle";
                toggleBtn.innerHTML = '<span class="arrow" style="font-size:.7em;">▶</span> <span style="font-size:.7em;">reasoning</span>';
                toggleBtn.addEventListener("click", () => {
                  toggleBtn.classList.toggle("expanded");
                  contentDiv.classList.toggle("visible");
                });
                
                reasoningContainer.appendChild(toggleBtn);
                reasoningContainer.appendChild(contentDiv);
                log.appendChild(reasoningContainer);
              }
              
              reasoningContent += msg.content;
              // Update the content div
              const contentDiv = reasoningContainer.querySelector(".reasoning-content");
              if (contentDiv) {
                contentDiv.textContent = reasoningContent;
                log.scrollTop = log.scrollHeight;
              }
            } else if (msg.type === "reasoning.end") {
              // Finalize reasoning
              if (reasoningContainer) {
                const toggleBtn = reasoningContainer.querySelector(".reasoning-toggle");
                if (toggleBtn) {
                  toggleBtn.innerHTML = '<span class="arrow" style="font-size:.7em;">▶</span> <span style="display:inline; font-size:.7em; font-weight:normal;">reasoned</span>';
                }
                // Auto-expand to show final content
                const contentDiv = reasoningContainer.querySelector(".reasoning-content");
                if (contentDiv && !contentDiv.classList.contains("visible")) {
                  // contentDiv.classList.add("visible");
                  // toggleBtn.classList.add("expanded");
                }
                reasoningContainer = null;
              }
              reasoningContent = "";
            }
            
            // Handle streaming deltas
            if (msg.type === "message.delta" && msg.content !== undefined) {
              // Hide progress bar when first message arrives
              progressContainer.style.display = "none";
              progressBar.style.width = "0%";
              progressText.textContent = "0%";
              
              if (!streamingContent) streamingContent = "";
              streamingContent += msg.content;
              // Update or create the assistant message div with accumulated content
              updateStreamingMessage(`${streamingContent}`);
              
              // Incremental TTS: speak once we have ~15 unspoken words
              if (document.getElementById("tts-enabled").checked) {
                const unspoken = streamingContent.slice(streamingSpokenIndex);
                const wordCount = unspoken.trim().split(/\s+/).filter(w => w.length > 0).length;
                if (wordCount >= 15) {
                  // Find a good break point (prefer sentence boundary)
                  let speakEnd = streamingSpokenIndex + unspoken.length;
                  const lastSentenceBreak = unspoken.lastIndexOf('. ');
                  const lastPeriod = unspoken.lastIndexOf('.');
                  if (lastPeriod > 0 && lastPeriod < unspoken.length - 2) {
                    speakEnd = streamingSpokenIndex + lastPeriod + 1; // include the period
                  }
                  const textToSpeak = `${streamingContent.slice(streamingSpokenIndex, speakEnd)}`;
                  streamingSpokenIndex = speakEnd;
                  const speakAfterComplete = document.getElementById("speak-after-complete").checked;
                  if (!speakAfterComplete && !isTTSSpeaking) speakText(textToSpeak, null);
                }
              }
            } else if (msg.type === "message.end") {
              // Finalize the streamed message
              if (streamingContent) {
                finalizeStreamingMessage();
                //streamingContent = null;
              }
            } else if (msg.type === "tool_call") {
              const args = JSON.stringify(msg.arguments, null, 2);
              addMsg("tool", `🔧 Tool: ${msg.tool}\n   Args: ${args}\n   Result: ${String(msg.output).slice(0, 300)}`);
            } else if (msg.type === "reasoning") {
              addMsg("reasoning", `💭 Reasoning:\n${msg.content}`);
            } else if (msg.type === "message") {
              const msgText = `${msg.content}`;
              addMsg("assistant", msgText);
              if (document.getElementById("tts-enabled").checked) {
                setTimeout(() => speakText(msgText, null), 100);
              }
            } else if (msg.type === "stats") {
              const s = msg;
              addMsg("stats", `⏱ ${s.time_to_first_token_seconds?.toFixed(2)}s TTFT · ${s.tokens_per_second?.toFixed(1)} tok/s · ${s.input_tokens} in / ${s.total_output_tokens} out`);
            } else if (msg.type === "chat.end") {
              // Capture response_id from chat.end for context retention
              if (msg.result && msg.result.response_id) {
                last_response_id_local = msg.result.response_id;
                if (debugEnabled.checked) console.log('Response ID captured:', msg.result.response_id);
              }
            }
          }
        }
        if (lastParsedMsg && lastParsedMsg.response_id) last_response_id_local = lastParsedMsg.response_id;
        last_response_id = last_response_id_local || null;
        status.textContent = "";
      } catch (err) {
        status.textContent = `Error: ${err.message}`;
      } finally {
        sendBtn.disabled = false;
        input.value = "";  // clear input after sending
        reader && reader.releaseLock();
      }
    }

    micBtn.addEventListener("click", () => {
      if (isRecording) stopListening();
      else startListening();
    });

    // Unified send handler that checks streamData setting
    async function handleSend() {
      const userText = input.value.trim();
      if (userText) {
        addMsg("user", userText);
      }
      if (streamData) {
        await sendStreaming();
      } else {
        await send();
      }
    }

    // --- NEW FUNCTIONALITY: Listen Voice Button ---
    document.getElementById("listen-voice-btn").addEventListener("click", async () => {
      const selectedVoice = document.getElementById("voice-select").value;
      const voiceInput = document.getElementById("voice-input");
      const textToSpeak = voiceInput.value.trim();

      if (!selectedVoice) {
        status.textContent = "Please select a voice first.";
        return;
      }
      if (!textToSpeak) {
        status.textContent = "Please enter the text you want to hear.";
        return;
      }

      try {
        // Assume speakText is globally available (from tts.js)
        await speakText(`${textToSpeak}`, null); 
        status.textContent = `Successfully played: "${textToSpeak}" in voice: ${selectedVoice}`;
      } catch (error) {
        status.textContent = `Error during speech playback: ${error.message}`;
      }
    });


    // Set up event listeners
    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", e => { 
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // --- Integration management ---
    function renderIntegrationsList() {
      integrationsListEl.innerHTML = "";
      if (!integrations.length) return;
      for (let i = 0; i < integrations.length; i++) {
        const item = integrations[i];
        let desc = "";
        if (item.type === "plugin") {
          desc = `🔌 Plugin: ${item.id} — tools: ${(item.allowed_tools || []).join(", ")}`;
        } else if (item.type === "ephemeral_mcp") {
          desc = `⚙️ MCP Server: ${item.name}${item.url ? " @ " + item.url : ""}`;
        }
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `<span>${desc}</span><button class="remove-btn" data-index="${i}" title="Remove">✕</button>`;
        integrationsListEl.appendChild(div);
      }
    }

    function addIntegration() {
      const type = integrationTypeSel.value;
      if (!type) return;

      let entry = { type };

      if (type === "plugin") {
        const id = document.getElementById("plugin-id").value.trim();
        const toolsRaw = document.getElementById("plugin-tools").value.trim();
        if (!id) { status.textContent = "Please enter a Plugin ID."; return; }
        entry.id = id;
        entry.allowed_tools = toolsRaw ? toolsRaw.split(/[,\s]+/).filter(Boolean) : [];
        } else if (type === "ephemeral_mcp") {
          const name = document.getElementById("mcp-server-name").value.trim();
          const url = document.getElementById("mcp-server-url").value.trim();
          if (!name) { status.textContent = "Please enter a Server name."; return; }
          entry.name = name;
          if (url) entry.url = url;
        }

      integrations.push(entry);
      renderIntegrationsList();
      integrationTypeSel.value = "";
      configPlugin.classList.remove("open");
      configMcpServer.classList.remove("open");
      status.textContent = `Added ${type}: ${entry.name || entry.id}`;
    }

    function removeIntegration(index) {
      integrations.splice(index, 1);
      renderIntegrationsList();
    }

    // Delegate clicks on the list for remove buttons
    integrationsListEl.addEventListener("click", e => {
      if (e.target.classList.contains("remove-btn")) {
        removeIntegration(parseInt(e.target.dataset.index, 10));
      }
    });

    addIntegrationBtn.addEventListener("click", addIntegration);
  
