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
   * @param {Uint8Array} buf buffer to push
   * @returns {void}
   */
  function genp(buf) {
    while(geni + buf.byteLength > genb.byteLength) genExpand();
    genb.set(buf, geni);
    geni += buf.byteLength;
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
   * gen length header and buffer
   * @param {Uint8Array} b buffer
   * @returns {Boolean} whether success
   */
  function genBuf(b) {
    var len = b.byteLength;
    if(len >= U32MAX) return false;
    var bytes = 0;
    if(len>0xffffff) bytes = 4;
    else while((len>>>8*++bytes)>0);
    // len bytes number of data len
    genp1(bytes);
    // len buffer of data
    while(bytes>0) genp1(len>>>8*--bytes&0xff);
    // data
    genp(b);
    return true;
  }

  /**
   * generate part of js value and push to buffer
   * @param {Any} o any js value
   * @returns {Boolean} whether `o` is available
   */
  function genPart(o) {
    if(o===null||o===undefined) return genp1(110)||true; // 110==n

    // array
    if(Array.isArray(o)) {
      genp1(91); // 91[
      var _i = geni;
      for(const v of o) 
        if(genPart(v)) genp1(44); // 44,
      if(geni>_i) geni--; // if nothing available in array, dont lower `geni`.
      genp1(93); // 93]
      return true;
    }

    // buffer and function
    if(o instanceof ArrayBuffer) o = new Uint8Array(o);
    if(o instanceof Uint8Array) return genBuf(o);

    switch(typeof o) {

      case "string": {
        genp1(34); // 34"
        if(o.includes('\\')) o = o.replace(/\\/g, "\\\\");
        if(o.includes('"')) o = o.replace(/"/g,'\\"');
        genp(UTF8.enc(o));
        genp1(34);
        return true;
      }

      case "bigint": 
      case "number": 
        return genp( UTF8.enc(o.toString()) )||true;

      case "boolean": 
        return genp1(o?116:102)||true; // 116t, 102f

      case "object": {
        genp1(123); // 123{
        var _i = geni;
        var ks = Object.keys(o);
        for(let key of ks) {
          if(key.includes(":")) key = key.replace(/:/g,"\\:");
          const kbuf = UTF8.enc(key);
          genp(kbuf);
          genp1(58); // 58:
          if(!genPart(o[key])) {
            geni -= kbuf.byteLength + 1;
            continue;
          }
          genp1(44); // 44,
        }
        if(geni>_i) geni--;
        genp1(125); // 125==}
        return true;
      }

      case "function": {
        genp1(99); // 99c
        o = UTF8.enc(o.toString());
        return genBuf(o);
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
  }





  // == parsing ==
  var pari = 0;
  var parSrc = new Uint8Array(0);

  /**
   * throw parsing error
   * @param {String} mes message
   */
  function parError(mes) {
    throw new SyntaxError(`${mes} expected, got '${String.fromCharCode(parSrc[pari])}' at ${pari}`);
  }

  /**
   * clear spaces before key
   */
  function parTrim() {
    for(var t = parSrc[pari]; t===32||t===10; t = parSrc[++pari]);
  }

  function par1(n) {
    pari++;
    return n;
  }

  /**
   * parse head and return according value
   * @returns {any} according format in js
   */
  function parPart() {
    parTrim();
    var s = parSrc[pari];

    // buffer
    if(s<=4) {
      var len = 0;
      while(s) 
        len |= parSrc[++pari]<<(8*(--s));
      pari += len+1;
      return parSrc.slice(pari-len, pari);
    }

    // number
    if(s>=48&&s<=57) {
      var _i = pari;
      var t = 0;
      while(t = parSrc[++pari]) if(t<46||t>57||pari>=parSrc.byteLength) 
        return parseInt(UTF8.dec(parSrc.slice(_i, pari)));
    }

    switch(s) {

      default: parError("valid format");

      // null n
      case 110: return par1(null);

      // function c
      case 99: 
        return par1(new Function("return "+UTF8.dec(parPart()))());

      // boolean t f
      case 102: return par1(false);
      case 116: return par1(true);

      // string "
      case 34: {
        var _i = ++pari;
        while(pari<parSrc.byteLength) {
          const t = parSrc[pari++];
          if(t===92) {
            pari++;
            continue;
          }
          if(t===34) 
            return UTF8.dec(parSrc.slice(_i, pari-1));
        }
        parError('ending \'"\'');
      }

      // object {
      case 123: {
        var o = {};
        if(parSrc[pari+1]===125) return par1(o);
        while(1) {
          parTrim();
          // get key
          var _i = ++pari;
          while(parSrc[pari++]!==58) if(pari>=parSrc.byteLength)
            parError("':'");
          var k = UTF8.dec(parSrc.slice(_i,pari-1));
          // get value
          o[k] = parPart();
          parTrim();
          // trim and find `,` or `}`
          if(parSrc[pari]===44) continue;
          if(parSrc[pari]===125) return par1(o);
          parError("ending '}'");
        }
      }

      // array
      case 91: {
        var a = [];
        if(parSrc[pari+1]===93) {
          pari+=2;
          return a;
        };
        while(1) {
          parTrim();
          pari++;
          a.push(parPart());
          parTrim();
          if(parSrc[pari]===44) continue;
          if(parSrc[pari]===93) return par1(a);
        }
      }

    }

  }

  /**
   * parse(source)
   * parse source into JS object
   * similar to JSON.parse but buffer supported
   * @param {Uint8Array|ArrayBuffer|String} source enumedly typed source
   */
  function parse(source) {
    // convert source into Uint8Array
    if(typeof source==="string"||source instanceof String) 
      parSrc = UTF8.enc(source);
    else if(source instanceof ArrayBuffer)
      parSrc = new Uint8Array(source);
    else parSrc = source;
    pari = 0;
    return parPart();
  };

  window.BSON = {
    gen,UTF8,parse,genBuf
  }

}()