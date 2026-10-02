// Forwards mono PCM blocks from the live input to the main thread.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(4096);
    this.n = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input.length) {
      const left = input[0];
      const right = input[1];
      for (let i = 0; i < left.length; i++) {
        this.buf[this.n++] = right ? (left[i] + right[i]) / 2 : left[i];
        if (this.n === this.buf.length) {
          this.port.postMessage(this.buf);
          this.buf = new Float32Array(4096);
          this.n = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCapture);
