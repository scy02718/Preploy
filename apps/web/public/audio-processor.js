// AudioWorklet processor that captures PCM16 audio at the worklet's sample rate
// and sends it to the main thread for streaming to OpenAI Realtime API
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    // Buffer ~100ms of audio before sending (at 24kHz = 2400 samples)
    this._bufferSize = 2400;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono

    // Append to buffer
    const newBuffer = new Float32Array(this._buffer.length + channelData.length);
    newBuffer.set(this._buffer);
    newBuffer.set(channelData, this._buffer.length);
    this._buffer = newBuffer;

    // Send when we have enough samples
    while (this._buffer.length >= this._bufferSize) {
      const chunk = this._buffer.slice(0, this._bufferSize);
      this._buffer = this._buffer.slice(this._bufferSize);

      // Convert float32 [-1, 1] to int16
      const int16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage({
        type: "audio",
        audio: int16.buffer,
      }, [int16.buffer]);
    }

    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
