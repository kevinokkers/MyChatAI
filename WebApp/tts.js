
    // --- Text-to-Speech (TTS) ---
    let ttsVoiceIndex = -1;    let currentUtterance = null;
    const femaleKeywords = ["zira", "aria", "samantha", "karen", "moira", "allison", "helena", "jenny", "anna", "victoria", "female", "tessa", "fiona", "amy"];

    function loadTTSVoices() {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return;
      
      // Build voice selector dropdown
      const select = document.getElementById("voice-select");
      select.innerHTML = "";
      
      // Separate female and other voices, prioritize neural ones
      let femaleNeuralVoices = [];
      let femaleStandardVoices = [];
      let otherEnglishVoices = [];
      
      for (let i = 0; i < voices.length; i++) {
        const name = voices[i].name.toLowerCase();
        const isFemale = femaleKeywords.some(kw => name.includes(kw));
        const isNeural = name.includes("neural") || name.includes("online") || name.includes("dnn");
        
        if (voices[i].lang.startsWith("en")) {
          if (isFemale && isNeural) femaleNeuralVoices.push(i);
          else if (isFemale) femaleStandardVoices.push(i);
          else otherEnglishVoices.push(i);
        }
      }
      
      // Add section header for female voices
      const femaleGroup = document.createElement("optgroup");
      femaleGroup.label = "👩 Female Voices";
      
      // Add neural female voices first (best quality)
      if (femaleNeuralVoices.length) {
        const neuralHeader = document.createElement("option");
        neuralHeader.value = "-1";
        neuralHeader.textContent = "── Neural (Best Quality) ──";
        neuralHeader.disabled = true;
        femaleGroup.appendChild(neuralHeader);
        
        for (const idx of femaleNeuralVoices) {
          const opt = document.createElement("option");
          opt.value = idx;
          opt.textContent = voices[idx].name + " ⭐";
          femaleGroup.appendChild(opt);
        }
      }
      
      // Add standard female voices
      if (femaleStandardVoices.length) {
        const stdHeader = document.createElement("option");
        stdHeader.value = "-1";
        stdHeader.textContent = "── Standard ──";
        stdHeader.disabled = true;
        femaleGroup.appendChild(stdHeader);
        
        for (const idx of femaleStandardVoices) {
          const opt = document.createElement("option");
          opt.value = idx;
          opt.textContent = voices[idx].name;
          femaleGroup.appendChild(opt);
        }
      }
      
      // If no female voices found, show a message
      if (!femaleNeuralVoices.length && !femaleStandardVoices.length) {
        const msg = document.createElement("option");
        msg.value = "-1";
        msg.textContent = "⚠️ No female voices detected (check Windows 11 voice settings)";
        msg.disabled = true;
        femaleGroup.appendChild(msg);
      }
      
      select.appendChild(femaleGroup);
      
      // Add other English voices section
      if (otherEnglishVoices.length) {
        const otherGroup = document.createElement("optgroup");
        otherGroup.label = "🔊 Other Voices";
        for (const idx of otherEnglishVoices) {
          const opt = document.createElement("option");
          opt.value = idx;
          opt.textContent = voices[idx].name + (voices[idx].localService ? " (Local)" : " (Online)");
          otherGroup.appendChild(opt);
        }
        select.appendChild(otherGroup);
      }
      
      // Restore saved selection or auto-select best female voice
      const savedIndex = localStorage.getItem("tts-voice-index");
      let selectedIndex = -1;
      
      if (savedIndex !== null && parseInt(savedIndex) >= 0 && parseInt(savedIndex) < voices.length) {
        selectedIndex = parseInt(savedIndex);
      } else if (femaleNeuralVoices.length > 0) {
        selectedIndex = femaleNeuralVoices[0];
      } else if (femaleStandardVoices.length > 0) {
        selectedIndex = femaleStandardVoices[0];
      }
      
      if (selectedIndex >= 0) {
        select.value = selectedIndex;
        ttsVoiceIndex = selectedIndex;
        const voiceName = voices[selectedIndex].name;
        const isNeural = voiceName.toLowerCase().includes("neural") || voiceName.toLowerCase().includes("online");
        if (debugEnabled.checked) console.log(`TTS: Selected voice #${selectedIndex}: ${voiceName} (${isNeural ? 'Neural ⭐' : 'Standard'})`);
      }
      
      // Save selection when changed
      select.addEventListener("change", () => {
        ttsVoiceIndex = parseInt(select.value);
        localStorage.setItem("tts-voice-index", select.value);
        const voices = speechSynthesis.getVoices();
        if (voices[ttsVoiceIndex] && debugEnabled.checked) {
          console.log(`TTS: Changed to voice #${ttsVoiceIndex}: ${voices[ttsVoiceIndex].name}`);
        }
      });
    }

    // Load voices (may need to wait for them to be available)
    speechSynthesis.onvoiceschanged = loadTTSVoices;
    window.addEventListener("load", loadTTSVoices);

    // --- TTS + Mic integration ---
    let isTTSSpeaking = false;
    let wasRecordingBeforeTTS = false; // Only resume if we were actually recording before TTS started
    let isPausingForTTS = false;

    function pauseRecognition() {
      if (recognition && isRecording) {
        isPausingForTTS = true; // Prevent onend from calling stopListening()
        try { recognition.stop(); } catch(e) {}
        status.textContent = "⏸️ TTS speaking… mic paused";
      }
    }

    function resumeRecognition() {
      if (isTTSSpeaking) return; // Still speaking, don't restart yet
      isPausingForTTS = false;
      startListening();
      status.textContent = "🎤 Listening… click the mic to stop.";
    }

    function speakText(text, btn) {
      // Stop any current speech
      speechSynthesis.cancel();
      
      if (btn) {
        btn.classList.add("speaking");
        btn.innerHTML = "⏹";
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance = utterance;
      isTTSSpeaking = true;

      // Track whether we were recording so we only resume if user was transcribing
      wasRecordingBeforeTTS = isRecording;

      // Pause mic while TTS speaks (prevents picking up AI voice)
      pauseRecognition();
      
      // Set voice if available
      if (ttsVoiceIndex >= 0) {
        const voices = speechSynthesis.getVoices();
        if (voices[ttsVoiceIndex]) {
          utterance.voice = voices[ttsVoiceIndex];
        }
      }
      
      // Optimize for natural-sounding speech
      utterance.lang = "en-US";
      utterance.rate = 0.95; // Slightly slower for clarity and naturalness
      utterance.pitch = 1.05; // Subtle pitch adjustment (less robotic)
      utterance.volume = 1.0;
      
      utterance.onend = () => {
        isTTSSpeaking = false;
        if (btn) {
          btn.classList.remove("speaking");
          btn.innerHTML = "🔊";
        }
        currentUtterance = null;
        // Resume mic after TTS finishes
        resumeRecognition();
      };
      
      utterance.onerror = () => {
        isTTSSpeaking = false;
        if (btn) {
          btn.classList.remove("speaking");
          btn.innerHTML = "🔊";
        }
        currentUtterance = null;
        // Resume mic on error too
        resumeRecognition();
      };
      
      speechSynthesis.speak(utterance);
    }

    // --- Voice transcription ---
    let recognition = null;
    let isRecording = false;
    let silenceTimer = null;
    const SILENCE_THRESHOLD_MS = 5000; // Auto-send after 5 seconds of silence

    function resetSilenceTimer() {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        // User stopped speaking for 5 seconds - auto-send the text
        const text = input.value.trim();
        if (text && isRecording) {
          status.textContent = "⏳ Silence detected, sending message…";
          stopListening();
          handleSend();
        }
      }, SILENCE_THRESHOLD_MS);
    }

    function startListening() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        status.textContent = "⚠️ Speech Recognition not supported in this browser. Try Chrome or Edge.";
        return;
      }

     if(recognition == null){
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
      }

      let finalTranscript = "";

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
            // Reset silence timer on new final result
            resetSilenceTimer();
          } else {
            interim += transcript;
          }
        }
        input.value = finalTranscript.trim() + interim;
      };

      recognition.onerror = (event) => {
        status.textContent = `⚠️ Speech error: ${event.error}`;
        stopListening();
      };

      recognition.onend = () => {
        // Auto-stop if silence detected; keep UI consistent
        if (isRecording) stopListening();
      };

      recognition.start();
      isRecording = true;
      micBtn.classList.add("recording");
      status.textContent = "🎤 Listening… click the mic to stop.";
      // Start the silence timer - will auto-send after 5 seconds of no speech
      resetSilenceTimer();
    }

    function stopListening() {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (recognition) {
        recognition.stop();
      }
      isRecording = false;
      micBtn.classList.remove("recording");
      status.textContent = "";
    }