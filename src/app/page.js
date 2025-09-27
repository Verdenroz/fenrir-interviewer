'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { getProblemConfig, getStarterCode, getProblemContext, getAvailableProblems, getProblemDisplayName } from '@/config/problems';

const CONVERSATION_STATES = {
  READY: 'ready',
  LISTENING: 'listening',
  AI_SPEAKING: 'ai_speaking'
};


export default function Home() {
  // Voice interaction state
  const [conversationState, setConversationState] = useState(CONVERSATION_STATES.READY);
  const [currentUserMessage, setCurrentUserMessage] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [error, setError] = useState(null);
  const [hasStartedInterview, setHasStartedInterview] = useState(false);

  // Problem selection state
  const [currentProblemId, setCurrentProblemId] = useState('two-sum');
  const [currentLanguage, setCurrentLanguage] = useState('python');

  // Code editor state
  const [codeContent, setCodeContent] = useState(() => getStarterCode('two-sum', 'python'));

  // Refs for voice functionality
  const socketRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const conversationStateRef = useRef(conversationState);
  const editorRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const transcriptBufferRef = useRef({});

  // Keep conversation state ref in sync
  useEffect(() => {
    conversationStateRef.current = conversationState;
  }, [conversationState]);

  const startInterview = useCallback(async () => {
    const welcomeMessage = `Welcome to your coding interview! I'll be helping you work through the "${getProblemDisplayName(currentProblemId)}" problem today.

To get started, could you please walk me through your initial thoughts on how you might approach this problem? Don't worry about writing code yet - I'm just interested in hearing your thought process and any strategies that come to mind.`;

    const aiMessage = { role: 'assistant', content: welcomeMessage, timestamp: Date.now() };
    setConversationHistory([aiMessage]);

    // Set state to ready immediately
    setConversationState(CONVERSATION_STATES.READY);
  }, [currentProblemId]);

  // Start interview immediately on component mount
  useEffect(() => {
    if (!hasStartedInterview) {
      startInterview();
      setHasStartedInterview(true);
    }
  }, [hasStartedInterview, startInterview]);

  const getToken = useCallback(async () => {
    try {
      const response = await fetch('/api/transcribe/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get token');
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error getting token:', error);
      throw error;
    }
  }, []);

  const playAudioResponse = useCallback(async (audioBlob) => {
    try {
      setConversationState(CONVERSATION_STATES.AI_SPEAKING);

      // Initialize audio context on first use and ensure it's resumed
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Resume audio context if it's suspended (required for autoplay policies)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const arrayBuffer = await audioBlob.arrayBuffer();

      try {
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);

        audioSourceRef.current = source;

        source.onended = () => {
          setConversationState(CONVERSATION_STATES.READY);
          audioSourceRef.current = null;
        };

        // Small delay to ensure audio context is ready
        setTimeout(() => {
          source.start();
        }, 100);

      } catch (decodeError) {
        console.warn('Web Audio API failed, falling back to HTML5 audio:', decodeError);

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        // Ensure audio can play
        audio.preload = 'auto';
        audio.volume = 1.0;

        audio.onended = () => {
          setConversationState(CONVERSATION_STATES.READY);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = (error) => {
          console.error('Audio element playback failed:', error);
          setError('Failed to play audio response');
          setConversationState(CONVERSATION_STATES.READY);
          URL.revokeObjectURL(audioUrl);
        };

        audio.oncanplaythrough = () => {
          audio.play().catch(playError => {
            console.error('Audio play failed:', playError);
            setError('Failed to play audio response');
            setConversationState(CONVERSATION_STATES.READY);
            URL.revokeObjectURL(audioUrl);
          });
        };

        audio.load(); // Trigger loading
      }

    } catch (error) {
      console.error('Error playing audio:', error);
      setError('Failed to play audio response: ' + error.message);
      setConversationState(CONVERSATION_STATES.READY);
    }
  }, []);

  const generateAiResponse = useCallback(async (userInput) => {
    if (!userInput.trim()) return;

    try {
      // Clear user message states immediately when AI starts responding
      setCurrentUserMessage('');
      setPartialTranscript('');
      setConversationState(CONVERSATION_STATES.AI_SPEAKING);

      const userMessage = { role: 'user', content: userInput, timestamp: Date.now() };
      setConversationHistory(prev => [...prev, userMessage]);

      const response = await fetch('/api/interview/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput,
          conversationHistory,
          problemContext: getProblemContext(currentProblemId),
          currentCode: codeContent,
          language: currentLanguage
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate response');
      }

      const data = await response.json();
      const responseText = data.text || 'I understand. Please continue.';

      const aiMessage = { role: 'assistant', content: responseText, timestamp: Date.now() };
      setConversationHistory(prev => [...prev, aiMessage]);

      let responseAudio = null;
      if (data.audio) {
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        responseAudio = new Blob([bytes], { type: 'audio/wav' });
      }

      if (responseAudio) {
        await playAudioResponse(responseAudio);
      } else {
        setConversationState(CONVERSATION_STATES.READY);
      }

    } catch (error) {
      console.error('Error generating AI response:', error);
      setError('Failed to generate response: ' + error.message);
      setConversationState(CONVERSATION_STATES.READY);
    }
  }, [conversationHistory, codeContent, currentProblemId, currentLanguage]);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      setConversationState(CONVERSATION_STATES.LISTENING);

      const token = await getToken();
      const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&formatted_finals=true&token=${token}`;

      socketRef.current = new WebSocket(wsUrl);
      transcriptBufferRef.current = {};
      let accumulatedTranscript = '';

      socketRef.current.onopen = async () => {
        console.log('WebSocket connection established, readyState:', socketRef.current.readyState);

        // Set up microphone
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);

        // Use scriptProcessor for better compatibility
        scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

        source.connect(scriptProcessorRef.current);
        scriptProcessorRef.current.connect(audioContextRef.current.destination);

        // Calculate resampling parameters
        const targetSampleRate = 16000;
        const sourceSampleRate = audioContextRef.current.sampleRate;
        const resampleRatio = sourceSampleRate / targetSampleRate;

        let audioChunkCount = 0;
        scriptProcessorRef.current.onaudioprocess = (event) => {
          if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            if (audioChunkCount % 100 === 0) console.log('Socket not ready, state:', socketRef.current?.readyState);
            return;
          }
          if (conversationStateRef.current !== CONVERSATION_STATES.LISTENING) return;

          const input = event.inputBuffer.getChannelData(0);

          // Check if we have audio input
          const hasAudio = input.some(sample => Math.abs(sample) > 0.001);
          if (!hasAudio && audioChunkCount % 100 === 0) {
            console.log('No audio detected in chunk', audioChunkCount);
          }

          // Resample to 16kHz if needed
          let processedData;
          if (Math.abs(sourceSampleRate - targetSampleRate) > 100) {
            // Need to resample
            const downsampledLength = Math.floor(input.length / resampleRatio);
            const downsampledData = new Float32Array(downsampledLength);

            for (let i = 0; i < downsampledLength; i++) {
              const sourceIndex = Math.floor(i * resampleRatio);
              downsampledData[i] = input[sourceIndex];
            }
            processedData = downsampledData;
            if (audioChunkCount === 0) console.log('Resampling from', sourceSampleRate, 'to', targetSampleRate);
          } else {
            // No resampling needed
            processedData = input;
            if (audioChunkCount === 0) console.log('No resampling needed, using', sourceSampleRate, 'Hz');
          }

          // Convert to 16-bit PCM
          const buffer = new Int16Array(processedData.length);
          for (let i = 0; i < processedData.length; i++) {
            buffer[i] = Math.max(-1, Math.min(1, processedData[i])) * 0x7fff;
          }

          try {
            socketRef.current.send(buffer.buffer);
            if (audioChunkCount % 100 === 0) {
              console.log('Sent audio chunk', audioChunkCount, 'size:', buffer.buffer.byteLength, 'bytes');
            }
          } catch (error) {
            console.error('Error sending audio data:', error);
          }

          audioChunkCount++;
        };
      };

      socketRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (conversationStateRef.current !== CONVERSATION_STATES.LISTENING) {
          return;
        }

        if (message.type === 'PartialTranscript' && message.text) {
          setPartialTranscript(message.text);

          // Clear any existing silence timeout when we get speech
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        }

        if (message.type === 'Turn' && message.transcript) {
          const { turn_order, transcript } = message;
          transcriptBufferRef.current[turn_order] = transcript;

          // Build the complete transcript from all turns
          const orderedTranscript = Object.keys(transcriptBufferRef.current)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => transcriptBufferRef.current[k])
            .join(' ');

          accumulatedTranscript = orderedTranscript;
          setCurrentUserMessage(accumulatedTranscript);
          setPartialTranscript('');

          // Set a silence timeout - only stop listening after genuine silence
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }

          silenceTimeoutRef.current = setTimeout(() => {
            if (conversationStateRef.current === CONVERSATION_STATES.LISTENING && accumulatedTranscript.trim()) {
              stopListening();
              generateAiResponse(accumulatedTranscript);
            }
          }, 3000); // Wait 3 seconds of silence before processing
        }
      };

      socketRef.current.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('WebSocket connection error');
        stopListening();
      };

      socketRef.current.onclose = (event) => {
        console.log('WebSocket closed. Code:', event.code, 'Reason:', event.reason, 'Was clean:', event.wasClean);
        // Only show error for unexpected closures (not normal closure codes)
        if (event.code !== 1000 && event.code !== 1005 && event.code !== 1001) {
          setError(`WebSocket closed unexpectedly: ${event.code} - ${event.reason}`);
        }
        socketRef.current = null;
      };

    } catch (error) {
      console.error('Error starting listening:', error);
      setError('Failed to start listening: ' + error.message);
      setConversationState(CONVERSATION_STATES.READY);
    }
  }, [getToken, generateAiResponse]);

  const stopListening = useCallback(async () => {
    try {
      // Clear silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      // Only change state if we're currently listening
      if (conversationStateRef.current === CONVERSATION_STATES.LISTENING) {
        setConversationState(CONVERSATION_STATES.READY);
      }

      // Close WebSocket
      if (socketRef.current) {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'Terminate' }));
        }
        socketRef.current.close();
        socketRef.current = null;
      }

      // Clean up audio processing
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      // Clear transcript buffer
      transcriptBufferRef.current = {};

    } catch (error) {
      console.error('Error stopping listening:', error);
    }
  }, []);

  const toggleMicrophone = useCallback(() => {
    if (conversationState === CONVERSATION_STATES.LISTENING) {
      stopListening();
    } else if (conversationState === CONVERSATION_STATES.READY) {
      startListening();
    }
  }, [conversationState, startListening, stopListening]);

  const handleEditorChange = (value) => {
    setCodeContent(value || '');
  };

  const handleProblemChange = (problemId) => {
    setCurrentProblemId(problemId);
    setCodeContent(getStarterCode(problemId, currentLanguage));
    setConversationHistory([]);
    setHasStartedInterview(false);
  };

  const handleLanguageChange = (language) => {
    setCurrentLanguage(language);
    setCodeContent(getStarterCode(currentProblemId, language));
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    editor.updateOptions({
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: 'vs-dark',
      padding: { top: 10, bottom: 10 }
    });
  };

  const getMicButtonState = () => {
    switch (conversationState) {
      case CONVERSATION_STATES.LISTENING:
        return {
          icon: '🎤',
          color: 'mic-listening',
          text: 'Listening...',
          disabled: false
        };
      case CONVERSATION_STATES.AI_SPEAKING:
        return {
          icon: '🔇',
          color: 'mic-disabled',
          text: 'AI Speaking...',
          disabled: true
        };
      default:
        return {
          icon: '🎤',
          color: 'mic-ready',
          text: 'Click to speak',
          disabled: false
        };
    }
  };

  const clearConversation = () => {
    setConversationHistory([]);
    setCurrentUserMessage('');
    setPartialTranscript('');
    setError(null);
    setHasStartedInterview(false);
    stopListening();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
    };
  }, [stopListening]);

  const micButton = getMicButtonState();

  return (
    <div className="app">
      {/* Main Interview Container */}
      <div className="interview-container">
        {/* Problem Description Panel */}
        <div className="problem-panel">
          <div className="problem-header">
            <h3 className="title">PROBLEM DESCRIPTION</h3>
            <div className="problem-controls">
              <select
                value={currentProblemId}
                onChange={(e) => handleProblemChange(e.target.value)}
                className="problem-selector"
              >
                {getAvailableProblems().map(problemId => (
                  <option key={problemId} value={problemId}>
                    {getProblemDisplayName(problemId)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p><strong>{getProblemDisplayName(currentProblemId)}</strong></p>
          <p className="problem_text">
            {getProblemContext(currentProblemId).description}
          </p>

          {getProblemContext(currentProblemId).testCases?.slice(0, 2).map((testCase, index) => (
            <div key={index} className="example">
              <strong>Example {index + 1}:</strong>
              <p>
                Input: {testCase.input}<br />
                Output: {testCase.output}<br />
                {testCase.explanation && <>Explanation: {testCase.explanation}</>}
              </p>
            </div>
          ))}
        </div>

        {/* Code Editor Panel */}
        <div className="code-panel">
          <div className="code-header">
            <h3 className="title">YOUR SOLUTION</h3>
            <div className="language-controls">
              <select
                value={currentLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="language-selector"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
              </select>
            </div>
          </div>

          <div className="editor-container">
            <Editor
              height="100%"
              language={currentLanguage}
              value={codeContent}
              theme="vs-dark"
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 14,
                fontFamily: 'Consolas, "Courier New", monospace',
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                padding: { top: 10, bottom: 10 },
                selectOnLineNumbers: true,
                roundedSelection: false,
                readOnly: false,
                cursorStyle: 'line',
                smoothScrolling: true
              }}
            />
          </div>
        </div>
      </div>

      {/* Voice Interaction Panel */}
      <div className="voice-panel">
        {/* Error Display */}
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Chat History */}
        <div className="chat-container">
          {conversationHistory.length === 0 ? (
            <div className="chat-empty">
              <div className="empty-icon">💬</div>
              <p>Starting interview...</p>
              <p className="empty-subtitle">The AI interviewer will begin shortly</p>
            </div>
          ) : (
            <div className="chat-messages">
              {conversationHistory.map((message, index) => (
                <div key={index} className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}>
                  <div className="message-label">
                    {message.role === 'user' ? 'You' : 'AI Interviewer'}
                  </div>
                  <div className="message-content">{message.content}</div>
                </div>
              ))}
            </div>
          )}

          {/* Current Speaking State - Only show when listening and not when AI is speaking */}
          {conversationState === CONVERSATION_STATES.LISTENING && (currentUserMessage || partialTranscript) && (
            <div className="message user speaking">
              <div className="message-label">You (speaking...)</div>
              <div className="message-content">
                {currentUserMessage}
                {partialTranscript && (
                  <span className="partial-transcript"> {partialTranscript}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Microphone Controls */}
        <div className="mic-controls">
          <div className="mic-button-container">
            <button
              onClick={toggleMicrophone}
              disabled={micButton.disabled}
              className={`mic-button ${micButton.color}`}
            >
              {micButton.icon}
            </button>
            <div className="mic-text">
              <div className="mic-status">{micButton.text}</div>
              {conversationState === CONVERSATION_STATES.LISTENING && (
                <div className="mic-hint">Speak naturally, pause when finished</div>
              )}
            </div>
          </div>

          <button onClick={clearConversation} className="clear-button">
            Clear Conversation
          </button>
        </div>
      </div>
    </div>
  );
}