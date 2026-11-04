/* Encode one transferred RGBA frame at a time, leaving controls responsive. */
importScripts('tool3-gif-encoder.js');
let encoder;
self.onmessage = ({data}) => {
  try {
    if (data.type === 'init') encoder = self.Tool3GifEncoder.createEncoder(data.width,data.height);
    else if (data.type === 'frame') encoder.addFrame(new Uint8ClampedArray(data.rgba),data.delayCs);
    else if (data.type === 'finish') {
      const bytes = encoder.finish(); encoder = null;
      self.postMessage({id:data.id,bytes:bytes.buffer},[bytes.buffer]);
      return;
    }
    self.postMessage({id:data.id,ok:true});
  } catch (error) { self.postMessage({id:data.id,error:error.message || String(error)}); }
};
