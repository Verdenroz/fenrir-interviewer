'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeTranscriber } from 'assemblyai';

export default function AssemblyRealtimeTranscriber() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const transcriberRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

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

  const startTranscription = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get temporary token
      const token = await getToken();

      // Initialize transcriber
      const transcriber = new RealtimeTranscriber({
        token: token,
        sampleRate: 16000
      });

      // Set up event listeners
      transcriber.on('open', ({ id, expires_at }) => {
        console.log('Session opened:', id, 'Expires at:', expires_at);
        setIsLoading(false);
        setIsTranscribing(true);
      });

      transcriber.on('transcript', (transcript) => {
        console.log('Received transcript:', transcript);
        if (transcript.message_type === 'FinalTranscript') {
          // Add final transcript and clear partial
          setTranscript(prev => prev + ' ' + transcript.text);
          setPartialTranscript('');
        } else if (transcript.message_type === 'PartialTranscript' && transcript.text) {
          // Update only the partial transcript
          setPartialTranscript(transcript.text);
        }
      });

      transcriber.on('error', (error) => {
        console.error('Transcriber error:', error);
        setError(error.message);
        setIsTranscribing(false);
        setIsLoading(false);
      });

      transcriber.on('close', (code, reason) => {
        console.log('Session closed:', code, reason);
        setIsTranscribing(false);
        setIsLoading(false);
      });

      // Connect to AssemblyAI
      await transcriber.connect();
      transcriberRef.current = transcriber;

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      try {
        // Load AudioWorklet processor
        await audioContext.audioWorklet.addModule('/audio-processor.js');

        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

        // Handle audio data from worklet
        workletNode.port.onmessage = (event) => {
          if (event.data.type === 'audioData' && transcriberRef.current) {
            transcriberRef.current.sendAudio(event.data.data);
          }
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

        // Store references for cleanup
        mediaRecorderRef.current = { audioContext, source, workletNode };

      } catch (workletError) {
        console.warn('AudioWorklet not supported, falling back to ScriptProcessor:', workletError);

        // Fallback to ScriptProcessor with smaller buffer for lower latency
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(1024, 1, 1); // Smaller buffer

        const targetSampleRate = 16000;
        const sourceSampleRate = audioContext.sampleRate;
        const resampleRatio = sourceSampleRate / targetSampleRate;

        processor.onaudioprocess = (event) => {
          if (transcriberRef.current) {
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);

            // Simple downsampling
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

            transcriberRef.current.sendAudio(pcmData.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        // Store references for cleanup
        mediaRecorderRef.current = { audioContext, source, processor };
      }

    } catch (error) {
      console.error('Error starting transcription:', error);
      setError(error.message);
      setIsLoading(false);
      setIsTranscribing(false);
    }
  }, [getToken]);

  const stopTranscription = useCallback(async () => {
    try {
      // Stop Web Audio API components
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

      // Close transcriber connection
      if (transcriberRef.current) {
        await transcriberRef.current.close();
        transcriberRef.current = null;
      }

      setIsTranscribing(false);
    } catch (error) {
      console.error('Error stopping transcription:', error);
      setError(error.message);
    }
  }, []);

  const toggleTranscription = useCallback(() => {
    if (isTranscribing) {
      stopTranscription();
    } else {
      startTranscription();
    }
  }, [isTranscribing, startTranscription, stopTranscription]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setPartialTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTranscription();
    };
  }, [stopTranscription]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          AssemblyAI Realtime Transcriber
        </h2>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={toggleTranscription}
            disabled={isLoading}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isTranscribing
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Loading...' : isTranscribing ? 'Stop Transcribing' : 'Start Transcribing'}
          </button>

          <button
            onClick={clearTranscript}
            className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${isTranscribing ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
          <span className="text-gray-600">
            {isTranscribing ? 'Recording and transcribing...' : 'Not recording'}
          </span>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 min-h-[200px]">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Transcript:</h3>
          <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
            {transcript && (
              <span>{transcript}</span>
            )}
            {partialTranscript && (
              <span className="text-blue-600 italic bg-blue-50 px-1 rounded">
                {partialTranscript}
              </span>
            )}
            {!transcript && !partialTranscript && (
              <span className="text-gray-500">Transcript will appear here when you start speaking...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}