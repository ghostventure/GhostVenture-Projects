export async function readBoundedMultipartForm(request, maxBytes) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return { error: "Choose a file to upload.", status: 400 };
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) return { error: "The upload is too large.", status: 413 };
  if (!request.body) return { error: "Choose a file to upload.", status: 400 };

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return { error: "The upload is too large.", status: 413 };
      }
      chunks.push(Buffer.from(value));
    }
    const bufferedRequest = new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: Buffer.concat(chunks, totalBytes)
    });
    try {
      return { form: await bufferedRequest.formData() };
    } catch {
      return { error: "Choose a valid file to upload.", status: 400 };
    }
  } catch {
    return { error: "The upload could not be read.", status: 400 };
  } finally {
    reader.releaseLock();
  }
}
