export interface IngestInput {
  url: string;
  text?: string;
}

export interface IngestResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export interface InputSource {
  fetch(input: IngestInput): Promise<IngestResult>;
}
