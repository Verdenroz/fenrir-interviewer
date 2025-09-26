// audio-processor.js - AudioWorklet for better performance
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.sourceSampleRate = sampleRate; // Global sampleRate from AudioWorklet
    this.resampleRatio = this.sourceSampleRate / this.targetSampleRate;
    this.bufferSize = 1024; // Smaller buffer for lower latency
    this.buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      const inputData = input[0];

      // Add to buffer
      this.buffer.push(...inputData);

      // Process when we have enough samples
      if (this.buffer.length >= this.bufferSize) {
        // Simple downsampling
        const downsampledLength = Math.floor(this.buffer.length / this.resampleRatio);
        const downsampledData = new Float32Array(downsampledLength);

        for (let i = 0; i < downsampledLength; i++) {
          const sourceIndex = Math.floor(i * this.resampleRatio);
          downsampledData[i] = this.buffer[sourceIndex];
        }

        // Convert to PCM 16-bit
        const pcmData = new Int16Array(downsampledLength);
        for (let i = 0; i < downsampledLength; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, downsampledData[i] * 32768));
        }

        // Send to main thread
        this.port.postMessage({
          type: 'audioData',
          data: pcmData.buffer
        });

        // Clear processed data from buffer
        this.buffer = this.buffer.slice(Math.floor(downsampledLength * this.resampleRatio));
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);