'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeTranscriber } from 'assemblyai';
import Editor from '@monaco-editor/react';

const CONVERSATION_STATES = {
  READY: 'ready',
  LISTENING: 'listening',
  AI_SPEAKING: 'ai_speaking'
};

const TWO_SUM_STARTER_CODE = `class Solution(object):
    def twoSum(self, nums, target):
        """
        :type nums: List[int]
        :type target: int
        :rtype: List[int]
        """
        # Write your solution here
        `;

export default function Home() {
  // Voice interaction state
  const [conversationState, setConversationState] = useState(CONVERSATION_STATES.READY);
  const [currentUserMessage, setCurrentUserMessage] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [error, setError] = useState(null);

  // Code editor state
  const [codeContent, setCodeContent] = useState(TWO_SUM_STARTER_CODE);

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

  const generateAiResponse = useCallback(async (userInput) => {
    if (!userInput.trim()) return;

    try {
      setConversationState(CONVERSATION_STATES.AI_SPEAKING);

      const userMessage = { role: 'user', content: userInput, timestamp: Date.now() };
      setConversationHistory(prev => [...prev, userMessage]);
      setCurrentUserMessage('');

      const response = await fetch('/api/interview/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput,
          conversationHistory
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
  }, [conversationHistory]);

  const playAudioResponse = useCallback(async (audioBlob) => {
    try {
      setConversationState(CONVERSATION_STATES.AI_SPEAKING);

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
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

        source.start();

      } catch (decodeError) {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

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

        await audio.play();
      }

    } catch (error) {
      console.error('Error playing audio:', error);
      setError('Failed to play audio response: ' + error.message);
      setConversationState(CONVERSATION_STATES.READY);
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      setConversationState(CONVERSATION_STATES.LISTENING);

      const token = await getToken();

      const transcriber = new RealtimeTranscriber({
        token: token,
        sampleRate: 16000
      });

      transcriber.on('open', ({ id }) => {
        console.log('Transcriber session opened:', id);
      });

      transcriber.on('transcript', (transcriptData) => {
        if (transcriptData.message_type === 'FinalTranscript' && transcriptData.text) {
          const finalText = transcriptData.text.trim();
          setCurrentUserMessage(prev => (prev + ' ' + finalText).trim());
          setPartialTranscript('');

          setTimeout(() => {
            if (conversationStateRef.current === CONVERSATION_STATES.LISTENING) {
              stopListening();
              generateAiResponse((currentUserMessage + ' ' + finalText).trim());
            }
          }, 2000);

        } else if (transcriptData.message_type === 'PartialTranscript' && transcriptData.text) {
          setPartialTranscript(transcriptData.text);
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
          noiseSuppression: true
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
  }, [getToken, generateAiResponse, conversationState]);

  const stopListening = useCallback(async () => {
    try {
      setConversationState(CONVERSATION_STATES.READY);

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

  const handleEditorDidMount = (editor, monaco) => {
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
          <h3 className="title">PROBLEM DESCRIPTION</h3>
          <p><strong>Two Sum — Easy</strong></p>
          <p className="problem_text">
            Given an array of integers <code>nums</code> and an integer <code>target</code>,
            return indices of the two numbers such that they add up to <code>target</code>.
          </p>
          <p className="problem_text">
            You may assume there is exactly one solution.
          </p>

          <div className="example">
            <strong>Example 1:</strong>
            <p>
              Input: nums = [2,7,11,15], target = 9<br />
              Output: [0,1]<br />
              Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
            </p>
          </div>

          <div className="example">
            <strong>Example 2:</strong>
            <p>
              Input: nums = [3,2,4], target = 6<br />
              Output: [1,2]
            </p>
          </div>
        </div>

        {/* Code Editor Panel */}
        <div className="code-panel">
          <h3 className="title">YOUR SOLUTION</h3>
          <div className="editor-container">
            <Editor
              height="100%"
              language="python"
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
              <p>Click the microphone to start your interview conversation</p>
              <p className="empty-subtitle">The AI will guide you through the Two Sum problem</p>
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

          {/* Current Speaking State */}
          {(currentUserMessage || partialTranscript) && (
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