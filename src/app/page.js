'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeTranscriber } from 'assemblyai';
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
  const transcriberRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const conversationStateRef = useRef(conversationState);
  const editorRef = useRef(null);

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

      const transcriber = new RealtimeTranscriber({
        token: token,
        sampleRate: 16000,
        endOfTurnSilenceThreshold: 1500,
        endOfTurnConfidenceThreshold: 0.9
      });

      transcriber.on('open', ({ id }) => {
        console.log('Transcriber session opened:', id);
      });

      let finalTranscriptTimeout = null;
      let endOfTurnDetected = false;
      let accumulatedTranscript = '';

      transcriber.on('transcript', (transcriptData) => {
        // Only process transcripts if we're still in listening state
        if (conversationStateRef.current !== CONVERSATION_STATES.LISTENING) {
          return;
        }

        if (transcriptData.message_type === 'FinalTranscript' && transcriptData.text) {
          const finalText = transcriptData.text.trim();
          accumulatedTranscript = (accumulatedTranscript + ' ' + finalText).trim();
          setCurrentUserMessage(accumulatedTranscript);
          setPartialTranscript('');

          // Clear any existing timeout
          if (finalTranscriptTimeout) {
            clearTimeout(finalTranscriptTimeout);
          }

          // Check if this is end of turn from AssemblyAI's detection
          if (transcriptData.end_of_turn) {
            endOfTurnDetected = true;
            // Process the final message
            if (conversationStateRef.current === CONVERSATION_STATES.LISTENING) {
              stopListening();
              generateAiResponse(accumulatedTranscript);
            }
          } else {
            // Set a longer fallback timeout for cases where end_of_turn isn't detected
            finalTranscriptTimeout = setTimeout(() => {
              if (conversationStateRef.current === CONVERSATION_STATES.LISTENING && !endOfTurnDetected) {
                stopListening();
                generateAiResponse(accumulatedTranscript);
              }
            }, 4000); // Increased timeout to 4 seconds
          }

        } else if (transcriptData.message_type === 'PartialTranscript' && transcriptData.text) {
          setPartialTranscript(transcriptData.text);
          // Reset end of turn flag when we get new partial transcript
          endOfTurnDetected = false;
        }
      });

      transcriber.on('error', (error) => {
        console.error('Transcriber error:', error);
        setError('Transcription error: ' + error.message);
        setConversationState(CONVERSATION_STATES.READY);
      });

      await transcriber.connect();
      transcriberRef.current = transcriber;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);

      try {
        await audioContext.audioWorklet.addModule('/audio-processor.js');
        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

        workletNode.port.onmessage = (event) => {
          if (event.data.type === 'audioData' && transcriberRef.current) {
            if (conversationStateRef.current === CONVERSATION_STATES.LISTENING) {
              transcriberRef.current.sendAudio(event.data.data);
            }
          }
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

        mediaRecorderRef.current = { audioContext, source, workletNode };

      } catch (workletError) {
        const bufferSize = 1024;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

        const targetSampleRate = 16000;
        const sourceSampleRate = audioContext.sampleRate;
        const resampleRatio = sourceSampleRate / targetSampleRate;

        const processAudio = (event) => {
          if (transcriberRef.current) {
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);

            if (conversationStateRef.current === CONVERSATION_STATES.LISTENING) {
              const downsampledLength = Math.floor(inputData.length / resampleRatio);
              const downsampledData = new Float32Array(downsampledLength);

              for (let i = 0; i < downsampledLength; i++) {
                const sourceIndex = Math.floor(i * resampleRatio);
                downsampledData[i] = inputData[sourceIndex];
              }

              const pcmData = new Int16Array(downsampledLength);
              for (let i = 0; i < downsampledLength; i++) {
                pcmData[i] = Math.max(-32768, Math.min(32767, downsampledData[i] * 32768));
              }

              transcriberRef.current.sendAudio(pcmData.buffer);
            }
          }
        };

        processor.addEventListener('audioprocess', processAudio);

        source.connect(processor);
        processor.connect(audioContext.destination);

        mediaRecorderRef.current = { audioContext, source, processor };
      }

    } catch (error) {
      console.error('Error starting listening:', error);
      setError('Failed to start listening: ' + error.message);
      setConversationState(CONVERSATION_STATES.READY);
    }
  }, [getToken, generateAiResponse]);

  const stopListening = useCallback(async () => {
    try {
      // Only change state if we're currently listening
      if (conversationStateRef.current === CONVERSATION_STATES.LISTENING) {
        setConversationState(CONVERSATION_STATES.READY);
      }

      if (transcriberRef.current) {
        await transcriberRef.current.close();
        transcriberRef.current = null;
      }

      if (mediaRecorderRef.current) {
        const { audioContext, source, processor, workletNode } = mediaRecorderRef.current;

        if (workletNode) {
          source.disconnect(workletNode);
          workletNode.disconnect(audioContext.destination);
        } else if (processor) {
          source.disconnect(processor);
          processor.disconnect(audioContext.destination);
        }

        if (audioContext && audioContext.state !== 'closed') {
          await audioContext.close();
        }
        mediaRecorderRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
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
      if (audioContextRef.current) {
        audioContextRef.current.close();
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