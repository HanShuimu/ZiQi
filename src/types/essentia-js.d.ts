declare module "essentia.js" {
  export const Essentia: new (EssentiaWASM: unknown, isDebug?: boolean) => {
    SpectrumCQ: (
      frame: unknown,
      binsPerOctave?: number,
      minFrequency?: number,
      minimumKernelSize?: number,
      numberBins?: number,
      sampleRate?: number,
      scale?: number,
      threshold?: number,
      windowType?: string,
      zeroPhase?: boolean
    ) => { spectrumCQ: unknown };
    arrayToVector: (inputArray: Float32Array) => unknown;
    vectorToArray: (inputVector: unknown) => Float32Array;
  };
  export const EssentiaWASM: unknown;
  const essentiaPackage: {
    Essentia: typeof Essentia;
    EssentiaWASM: typeof EssentiaWASM;
  };
  export default essentiaPackage;
}

declare module "essentia.js/dist/essentia.js-core.es.js";
declare module "essentia.js/dist/essentia-wasm.es.js";
