import { ReplaySubject } from "rxjs";

export async function writeJsonLineResponseToEventStream<T>(
  response: ReadableStream<Uint8Array>,
  eventStream$: ReplaySubject<T>,
) {
  const reader = response.getReader();
  const decoder = new TextDecoder();
  let buffer = [];

  function flushBuffer() {
    const currentBuffer = buffer.join("");
    if (currentBuffer.trim().length === 0) {
      return;
    }
    const parts = currentBuffer.split("\n");
    if (parts.length === 0) {
      return;
    }

    const lastPartIsComplete = currentBuffer.endsWith("\n");

    // truncate buffer
    buffer = [];

    if (!lastPartIsComplete) {
      // put back the last part
      buffer.push(parts.pop());
    }

    parts
      .map((part) => part.trim())
      .filter((part) => part != "")
      .forEach((part) => {
        eventStream$.next(JSON.parse(part));
      });
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (!done) {
        buffer.push(decoder.decode(value, { stream: true }));
      }

      flushBuffer();

      if (done) {
        break;
      }
    }
  } catch (error) {
    console.error("Error in stream", error);
    eventStream$.error(error);
    return;
  }
  eventStream$.complete();
}
