import { IngestInput, IngestResult, InputSource } from "./types";

export class StubInputSource implements InputSource {
  async fetch(_input: IngestInput): Promise<IngestResult> {
    void _input;
    return {
      ok: true,
      text: "",
    };
  }
}
