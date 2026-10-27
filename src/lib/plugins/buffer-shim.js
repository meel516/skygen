const encoder = new TextEncoder();

function from(value, encoding) {
  if (typeof value === 'string') {
    if (encoding === 'base64') {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    return encoder.encode(value);
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }

  return new Uint8Array();
}

globalThis.Buffer = globalThis.Buffer ?? {
  from,
  alloc(size) {
    return new Uint8Array(size);
  },
  isBuffer(value) {
    return value instanceof Uint8Array;
  },
};
