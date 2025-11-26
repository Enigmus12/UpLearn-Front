// Noise gate simple con histéresis para voz.
// thresholdDb: umbral de apertura (ej. -50 dB)
// hysteresisDb: histéresis para cerrar (ej. 2 dB)
// reduction: atenuación cuando está cerrado (0..1)

class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  constructor(options) {
    super();
    const p = (options && options.processorOptions) || {};
    this.thresholdDb = typeof p.thresholdDb === 'number' ? p.thresholdDb : -50;
    this.hysteresisDb = typeof p.hysteresisDb === 'number' ? p.hysteresisDb : 2;
    this.reduction = typeof p.reduction === 'number' ? p.reduction : 0.15;

    this.open = false;
    this.thLinear = this.dbToLinear(this.thresholdDb);
    this.thCloseLinear = this.dbToLinear(this.thresholdDb - this.hysteresisDb);
  }

  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  process(inputs, outputs/*, parameters*/) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }
    const inCh = input[0];
    const outCh = output[0];

    for (let i = 0; i < inCh.length; i++) {
      const x = inCh[i];
      const level = Math.abs(x);

      // Abrir cuando supera umbral principal
      if (!this.open && level >= this.thLinear) {
        this.open = true;
      }
      // Cerrar cuando cae por debajo del umbral de cierre
      else if (this.open && level < this.thCloseLinear) {
        this.open = false;
      }

      // Si está "cerrado", atenuar fuerte
      outCh[i] = this.open ? x : x * this.reduction;
    }

    return true;
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);
