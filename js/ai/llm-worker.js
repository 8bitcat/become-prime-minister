// Arbetstråd för den lokala språkmodellen (WebLLM/WebGPU) – håller spelet följsamt medan modellen tänker.
import { WebWorkerMLCEngineHandler } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
