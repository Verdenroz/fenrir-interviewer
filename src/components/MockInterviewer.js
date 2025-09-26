'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeTranscriber } from 'assemblyai';

const CONVERSATION_STATES = {
  READY: 'ready',        // User can start talking
  LISTENING: 'listening', // Recording user speech
  AI_SPEAKING: 'ai_speaking' // AI is responding, mic disabled
};

export default function MockInterviewer() {
  // State management
  const [conversationState, setConversationState] = useState(CONVERSATION_STATES.READY);
  const [currentUserMessage, setCurrentUserMessage] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [error, setError] = useState(null);

  // Refs
  const transcriberRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const conversationStateRef = useRef(conversationState);

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

      // Add user message to history first
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

      // Add AI message to history
      const aiMessage = { role: 'assistant', content: responseText, timestamp: Date.now() };
      setConversationHistory(prev => [...prev, aiMessage]);

      // Convert base64 audio back to blob
      let responseAudio = null;
      if (data.audio) {
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        responseAudio = new Blob([bytes], { type: 'audio/wav' });
      }1

      // Play the audio response
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
      setConversationState(CONVERSATION_STATES.SPEAKING);

      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      try {
        // Try to decode as standard audio format first
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

        // Create and play audio source
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
        console.log('Failed to decode with Web Audio API, trying alternative method:', decodeError);

        // Fallback: Create audio element for direct playback
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

      // Get temporary token
      const token = await getToken();

      // Initialize transcriber
      const transcriber = new RealtimeTranscriber({
        token: token,
        sampleRate: 16000
      });

      // Set up event listeners
      transcriber.on('open', ({ id }) => {
        console.log('Transcriber session opened:', id);
      });

      transcriber.on('transcript', (transcriptData) => {
        if (transcriptData.message_type === 'FinalTranscript' && transcriptData.text) {
          console.log('Final transcript:', transcriptData.text);
          const finalText = transcriptData.text.trim();
          setCurrentUserMessage(prev => (prev + ' ' + finalText).trim());
          setPartialTranscript('');

          // Auto-generate AI response after user stops speaking
          setTimeout(() => {
            if (conversationStateRef.current === CONVERSATION_STATES.LISTENING) {
              stopListening();
              generateAiResponse((currentUserMessage + ' ' + finalText).trim());
            }
          }, 2000); // Wait 2 seconds for user to continue

        } else if (transcriptData.message_type === 'PartialTranscript' && transcriptData.text) {
          setPartialTranscript(transcriptData.text);
        }
      });

      transcriber.on('error', (error) => {
        console.error('Transcriber error:', error);
        setError('Transcription error: ' + error.message);
        setConversationState(CONVERSATION_STATES.READY);
      });

      // Connect to AssemblyAI
      await transcriber.connect();
      transcriberRef.current = transcriber;

      // Set up audio capture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      streamRef.current = stream;
      console.log('Got media stream:', stream);
      console.log('Stream tracks:', stream.getTracks());

      const audioContext = new AudioContext();
      console.log('AudioContext sample rate:', audioContext.sampleRate);
      const source = audioContext.createMediaStreamSource(stream);

      try {
        await audioContext.audioWorklet.addModule('/audio-processor.js');
        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

        workletNode.port.onmessage = (event) => {
          if (event.data.type === 'audioData' && transcriberRef.current) {
            console.log('Received audio from worklet, size:', event.data.data.byteLength, 'state:', conversationStateRef.current);
            if (conversationStateRef.current === CONVERSATION_STATES.LISTENING) {
              console.log('Sending audio to transcriber');
              transcriberRef.current.sendAudio(event.data.data);
            }
          }
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

        mediaRecorderRef.current = { audioContext, source, workletNode };

      } catch (workletError) {
        console.warn('AudioWorklet not available, using ScriptProcessor:', workletError);

        // Fallback to ScriptProcessor (with deprecation warnings suppressed)
        const bufferSize = 1024;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

        const targetSampleRate = 16000;
        const sourceSampleRate = audioContext.sampleRate;
        const resampleRatio = sourceSampleRate / targetSampleRate;

        const processAudio = (event) => {
          if (transcriberRef.current) {
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);

            // Only process if in listening state
            if (conversationStateRef.current === CONVERSATION_STATES.LISTENING) {
              // Resample audio
              const downsampledLength = Math.floor(inputData.length / resampleRatio);
              const downsampledData = new Float32Array(downsampledLength);

              for (let i = 0; i < downsampledLength; i++) {
                const sourceIndex = Math.floor(i * resampleRatio);
                downsampledData[i] = inputData[sourceIndex];
              }

              // Convert to PCM 16-bit
              const pcmData = new Int16Array(downsampledLength);
              for (let i = 0; i < downsampledLength; i++) {
                pcmData[i] = Math.max(-32768, Math.min(32767, downsampledData[i] * 32768));
              }

              console.log('Sending audio from ScriptProcessor, samples:', pcmData.length, 'state:', conversationStateRef.current);
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

      // Stop transcriber
      if (transcriberRef.current) {
        await transcriberRef.current.close();
        transcriberRef.current = null;
      }

      // Stop audio processing
      if (mediaRecorderRef.current) {
        const { audioContext, source, processor, workletNode } = mediaRecorderRef.current;

        if (workletNode) {
          // AudioWorklet cleanup
          source.disconnect(workletNode);
          workletNode.disconnect(audioContext.destination);
        } else if (processor) {
          // ScriptProcessor cleanup
          source.disconnect(processor);
          processor.disconnect(audioContext.destination);
        }

        if (audioContext && audioContext.state !== 'closed') {
          await audioContext.close();
        }
        mediaRecorderRef.current = null;
      }

      // Stop media stream
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
    // Do nothing if AI_SPEAKING (mic is disabled)
  }, [conversationState, startListening, stopListening]);

  const startNewConversation = useCallback(async () => {
    setConversationHistory([]);
    setCurrentUserMessage('');
    setPartialTranscript('');
    setError(null);
    setConversationState(CONVERSATION_STATES.READY);

    // Generate opening greeting
    await generateAiResponse("Hello! I'm ready to start our conversation.");
  }, [generateAiResponse]);

  const clearAll = useCallback(() => {
    setCurrentUserMessage('');
    setPartialTranscript('');
    setConversationHistory([]);
    setError(null);
    stopListening();
  }, [stopListening]);

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

  const getMicButtonState = () => {
    switch (conversationState) {
      case CONVERSATION_STATES.LISTENING:
        return {
          icon: '🎤',
          color: 'bg-red-500 hover:bg-red-600 animate-pulse',
          text: 'Listening...',
          disabled: false
        };
      case CONVERSATION_STATES.AI_SPEAKING:
        return {
          icon: '🔇',
          color: 'bg-gray-400 cursor-not-allowed',
          text: 'AI Speaking...',
          disabled: true
        };
      default:
        return {
          icon: '🎤',
          color: 'bg-blue-500 hover:bg-blue-600',
          text: 'Click to speak',
          disabled: false
        };
    }
  };

  const micButton = getMicButtonState();

  return (
    <div className="max-w-4xl mx-auto p-4 h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            AI Interview Assistant
          </h2>
          <div className="flex gap-2">
            <button
              onClick={startNewConversation}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              New Chat
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 bg-white rounded-lg shadow-sm p-4 overflow-y-auto mb-4">
        {conversationHistory.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg">Click the microphone to start your conversation</p>
            <p className="text-sm mt-2">The AI will respond with voice and text</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conversationHistory.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : 'bg-gray-200 text-gray-800 rounded-bl-sm'
                }`}>
                  <div className="text-sm opacity-75 mb-1">
                    {message.role === 'user' ? 'You' : 'AI Assistant'}
                  </div>
                  <div>{message.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Current User Message (while typing/speaking) */}
        {(currentUserMessage || partialTranscript) && (
          <div className="flex justify-end mt-4">
            <div className="max-w-[80%] p-3 bg-blue-100 text-blue-800 rounded-lg rounded-br-sm border-2 border-blue-200">
              <div className="text-sm opacity-75 mb-1">You (speaking...)</div>
              <div>
                {currentUserMessage}
                {partialTranscript && (
                  <span className="italic opacity-75"> {partialTranscript}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Microphone Control */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={toggleMicrophone}
            disabled={micButton.disabled}
            className={`w-20 h-20 rounded-full text-white text-2xl font-bold transition-all duration-200 ${micButton.color} ${
              !micButton.disabled ? 'active:scale-95' : ''
            }`}
          >
            {micButton.icon}
          </button>

          <div className="text-center">
            <div className="font-medium text-gray-700">
              {micButton.text}
            </div>
            {conversationState === CONVERSATION_STATES.LISTENING && (
              <div className="text-sm text-gray-500 mt-1">
                Speak naturally, pause when finished
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}