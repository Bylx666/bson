!function(){

  // init utf8 utils
  var UTF8 = {
    enc: TextEncoder.prototype.encode.bind(new TextEncoder()),
    dec: TextDecoder.prototype.decode.bind(new TextDecoder())
  };





  // == generating ==
  const U32MAX = 2**32;
  var genSpace = 0;
  var genb = new Uint8Array(65536); // gen buffer
  var geni = 0; // gen index

  /**
   * require for more 65536 memory for gen buffer
   */
  function genExpand() {
    var b = new Uint8Array(genb.byteLength + 65536);
    b.set(genb);
    genb = b;
  }

  /**
   * push to generated buffer
   * @param {...Uint8Array} buffers buffer to push
   * @returns {void}
   */
  function genp() {
    for(const buf of arguments) {
      while(geni + buf.byteLength > genb.byteLength) genExpand();
      genb.set(buf, geni);
      geni += buf.byteLength;
    }
  };

  /**
   * push to buffer with one byte number
   * @param {Uint8} n
   * @returns {void}
   */
  function genp1(n) {
    if(geni + 1 > genb.byteLength) genExpand();
    genb[geni++] = n;
  }

  /**
   * generate part of js value and push to buffer
   * @param {Any} o any js value
   * @returns {Boolean} whether type of `o` is supported
   */
  function genPart(o) {
    if(o===null) return genp1(110)||true; // 110==n

    // buffer
    if(o instanceof ArrayBuffer) o = new Uint8Array(o);
    if(o instanceof Uint8Array) {
      var len = o.byteLength;
      if(len >= U32MAX) return false;
      // push length number of data length
      var byte = 0;
      while(len>(256**(++byte))); // get length of bytes of content length
      genp1(byte);
      // push data length
      while(--byte>=0) genp1((len>>(byte*8))&0xff);
      // push data
      genp(o);
      return true;
    }

    // array
    if(Array.isArray(o)) {
      genp1(91); // 91[
      var _geni = geni;
      for(const v of o) 
        if(genPart(v)) genp1(44); // 44,
      if(geni>_geni) geni--; // if nothing available in array, dont lower `geni`.
      genp1(93); // 93]
      return true;
    }

    switch(typeof o) {

      case "string": {
        genp1(34); // 34"
        genp(UTF8.enc(o));
        genp1(34);
        return true;
      }

      case "number": 
        return genp( UTF8.enc(o.toString()) )||true;

      case "boolean": 
        return genp1(o?116:102)||true; // 116t, 102f

      case "object": {
        genp1(123); // 123{
        var _geni = geni;
        var ks = Object.keys(o);
        for(const key of ks) {
          const kbuf = UTF8.enc(key);
          genp(kbuf);
          genp1(58); // 58:
          if(!genPart(o[key])) {
            geni -= kbuf.byteLength + 1;
            continue;
          }
          genp1(44); // 44,
        }
        if(geni>_geni) geni--;
        genp1(125); // 125==}
        return true;
      }

    }
    return false;
  }

  /**
   * gen(obj, isStr)
   * generate buffer or string for internet transfers
   * similar to JSON.stringify but buffer supported
   * @param {Any} obj JS Object
   * @param {Number} space while space>0, file will be formated with specified tab size
   */
  function gen(obj, space) {
    // init generation
    genSpace = space;
    genb = new Uint8Array(65536);
    geni = 0;
    genPart(obj);
    var u = genb.slice(0, geni);
    u.toString = ()=> UTF8.dec(r);
    return u;
  };





  // == parsing ==

  /**
   * parse(source)
   * parse source into JS object
   * similar to JSON.parse but buffer supported
   * @param {Uint8Array|ArrayBuffer|String} source enumedly typed source
   */
  function parse(source) {
    // convert source into Uint8Array
    var s;
    if(typeof source==="string"||source instanceof String) 
      s = UTF8.enc(source);
    if(source instanceof ArrayBuffer)
      s = new Uint8Array(source);

    // 
  };

  window.BSON = {
    gen,UTF8,genp,genp1
  }

}()